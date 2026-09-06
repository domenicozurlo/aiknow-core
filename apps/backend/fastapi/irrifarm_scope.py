import json
import os

from sqlglot import exp, parse_one
from sqlglot.errors import ParseError


class IrrifarmScopeError(ValueError):
    pass


def load_scope_policy() -> tuple[dict[str, str], set[str]]:
    raw_columns = os.environ.get("IRRIFARM_MBO_SCOPE_COLUMNS", "{}")
    try:
        parsed = json.loads(raw_columns)
    except json.JSONDecodeError as error:
        raise IrrifarmScopeError(
            "IRRIFARM_MBO_SCOPE_COLUMNS must be a JSON object"
        ) from error
    if not isinstance(parsed, dict) or not all(
        isinstance(table, str) and isinstance(column, str)
        for table, column in parsed.items()
    ):
        raise IrrifarmScopeError(
            "IRRIFARM_MBO_SCOPE_COLUMNS must map table names to column names"
        )

    columns = {table.lower(): column for table, column in parsed.items()}
    unscoped = {
        table.strip().lower()
        for table in os.environ.get("IRRIFARM_MBO_UNSCOPED_TABLES", "").split(",")
        if table.strip()
    }
    return columns, unscoped


def apply_irrifarm_scope(
    sql: str,
    allowed_mbo_sns: list[str],
    dialect: str,
    scope_columns: dict[str, str] | None = None,
    unscoped_tables: set[str] | None = None,
) -> str:
    columns, unscoped = (
        (scope_columns, unscoped_tables or set())
        if scope_columns is not None
        else load_scope_policy()
    )
    if not columns:
        raise IrrifarmScopeError("No Irrifarm MBO scope policy is configured")

    safe_serials = _validate_serials(allowed_mbo_sns)
    sqlglot_dialect = _sqlglot_dialect(dialect)
    try:
        statement = parse_one(sql, read=sqlglot_dialect)
    except ParseError as error:
        raise IrrifarmScopeError("The SQL query could not be scoped safely") from error

    if not isinstance(statement, (exp.Select, exp.Union)):
        raise IrrifarmScopeError("Only SELECT queries are allowed for Irrifarm users")

    cte_names = {
        cte.alias_or_name.lower()
        for cte in statement.find_all(exp.CTE)
        if cte.alias_or_name
    }
    physical_tables = [
        table
        for table in list(statement.find_all(exp.Table))
        if table.name.lower() not in cte_names
    ]
    if not physical_tables:
        raise IrrifarmScopeError("The query does not reference a scoped table")

    for table in physical_tables:
        table_name = table.name.lower()
        column = columns.get(table_name)
        if column is None:
            if table_name in unscoped:
                continue
            raise IrrifarmScopeError(
                f"Table '{table.name}' has no Irrifarm MBO scope rule"
            )
        _replace_with_scoped_subquery(table, column, safe_serials)

    return statement.sql(dialect=sqlglot_dialect)


def apply_irrifarm_query_guardrails(
    sql: str,
    dialect: str,
    max_rows: int,
    timeout_ms: int,
) -> tuple[str, int]:
    if max_rows <= 0:
        raise IrrifarmScopeError("IRRIFARM_MAX_QUERY_ROWS must be positive")
    if timeout_ms <= 0:
        raise IrrifarmScopeError("IRRIFARM_QUERY_TIMEOUT_MS must be positive")

    sqlglot_dialect = _sqlglot_dialect(dialect)
    try:
        statement = parse_one(sql, read=sqlglot_dialect)
    except ParseError as error:
        raise IrrifarmScopeError("The SQL query could not be guarded safely") from error

    if not isinstance(statement, (exp.Select, exp.Union)):
        raise IrrifarmScopeError("Only SELECT queries are allowed for Irrifarm users")

    existing_limit = _literal_row_limit(statement)
    applied_limit = min(existing_limit, max_rows) if existing_limit else max_rows
    if existing_limit is None or existing_limit > max_rows:
        statement.limit(max_rows, copy=False)

    if sqlglot_dialect == "mysql":
        _set_mysql_execution_timeout(statement, timeout_ms)

    return statement.sql(dialect=sqlglot_dialect), applied_limit


def _replace_with_scoped_subquery(
    table: exp.Table, column: str, serials: list[str]
) -> None:
    alias = table.alias_or_name
    source = table.copy()
    source.set("alias", None)

    predicate: exp.Expression
    if serials:
        predicate = exp.In(
            this=exp.column(column),
            expressions=[exp.Literal.string(serial) for serial in serials],
        )
    else:
        predicate = exp.false()

    scoped = exp.select("*").from_(source).where(predicate)
    table.replace(
        exp.Subquery(
            this=scoped,
            alias=exp.TableAlias(this=exp.to_identifier(alias)),
        )
    )


def _validate_serials(values: list[str]) -> list[str]:
    if len(values) > 5000:
        raise IrrifarmScopeError("Too many Irrifarm MBO serials")
    normalized: list[str] = []
    for value in values:
        if not isinstance(value, str):
            raise IrrifarmScopeError("Invalid Irrifarm MBO serial")
        serial = value.strip()
        if not serial or len(serial) > 128 or any(ord(char) < 32 for char in serial):
            raise IrrifarmScopeError("Invalid Irrifarm MBO serial")
        normalized.append(serial)
    return sorted(set(normalized))


def _literal_row_limit(statement: exp.Select | exp.Union) -> int | None:
    limit = statement.args.get("limit")
    if not isinstance(limit, exp.Limit) or not isinstance(
        limit.expression, exp.Literal
    ):
        return None
    if limit.expression.is_string:
        return None
    try:
        value = int(limit.expression.name)
    except ValueError:
        return None
    return value if value > 0 else None


def _set_mysql_execution_timeout(
    statement: exp.Select | exp.Union, timeout_ms: int
) -> None:
    target = statement if isinstance(statement, exp.Select) else statement.this
    if not isinstance(target, exp.Select):
        return

    existing_hint = target.args.get("hint")
    expressions = (
        [
            expression
            for expression in existing_hint.expressions
            if not (
                isinstance(expression, exp.Anonymous)
                and expression.name.upper() == "MAX_EXECUTION_TIME"
            )
        ]
        if isinstance(existing_hint, exp.Hint)
        else []
    )
    expressions.append(
        exp.Anonymous(
            this="MAX_EXECUTION_TIME",
            expressions=[exp.Literal.number(timeout_ms)],
        )
    )
    target.set("hint", exp.Hint(expressions=expressions))


def _sqlglot_dialect(dialect: str) -> str:
    return {"mssql": "tsql", "postgresql": "postgres"}.get(dialect, dialect)
