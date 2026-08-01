from __future__ import annotations

from typing import TYPE_CHECKING, Any, Literal, cast

from pydantic import Field, field_validator

from nao_core.config.exceptions import InitError
from nao_core.ui import ask_text

if TYPE_CHECKING:
    from ibis import BaseBackend

from .base import DatabaseConfig
from .context import DatabaseContext

SYSTEM_SCHEMAS = ("information_schema", "mysql", "performance_schema", "sys")
MysqlSslMode = Literal["DISABLED", "PREFERRED", "REQUIRED", "VERIFY_CA", "VERIFY_IDENTITY"]


class MysqlDatabaseContext(DatabaseContext):
    """MySQL context with information_schema description discovery."""

    def _quote(self, name: str) -> str:
        return f"`{name}`"

    def description(self) -> str | None:
        try:
            query = f"""
                SELECT TABLE_COMMENT
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = '{self._schema}' AND TABLE_NAME = '{self._table_name}'
            """
            row = self._conn.raw_sql(query).fetchone()  # type: ignore[union-attr]
            if row and row[0]:
                return str(row[0]).strip() or None
        except Exception:
            pass
        return None

    def columns(self) -> list[dict[str, Any]]:
        cols = super().columns()
        try:
            col_descs = self._fetch_column_descriptions()
            for col in cols:
                if desc := col_descs.get(col["name"]):
                    col["description"] = desc
        except Exception:
            pass
        return cols

    def _fetch_column_descriptions(self) -> dict[str, str]:
        query = f"""
            SELECT COLUMN_NAME, COLUMN_COMMENT
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = '{self._schema}' AND TABLE_NAME = '{self._table_name}'
        """
        rows = self._conn.raw_sql(query).fetchall()  # type: ignore[union-attr]
        return {row[0]: str(row[1]) for row in rows if row[1]}


class MysqlConfig(DatabaseConfig):
    """MySQL-specific configuration."""

    type: Literal["mysql"] = "mysql"
    host: str = Field(description="MySQL host")
    port: int = Field(default=3306, description="MySQL port")
    database: str = Field(description="Database name")
    user: str = Field(description="Username")
    password: str = Field(description="Password")
    schema_name: str | None = Field(default=None, description="Default schema (optional)")
    ssl_mode: MysqlSslMode | None = Field(
        default=None,
        description="MySQL SSL mode (optional). Use REQUIRED for servers that require encrypted transport.",
    )
    ssl_ca: str | None = Field(default=None, description="Path to SSL CA certificate file (optional)")
    ssl_cert: str | None = Field(default=None, description="Path to SSL client certificate file (optional)")
    ssl_key: str | None = Field(default=None, description="Path to SSL client key file (optional)")

    @field_validator("ssl_mode", mode="before")
    @classmethod
    def _normalize_ssl_mode(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            return value.upper() if value else None
        return value

    @classmethod
    def promptConfig(cls) -> "MysqlConfig":
        """Interactively prompt the user for MySQL configuration."""
        name = ask_text("Connection name:", default="mysql-prod") or "mysql-prod"
        host = ask_text("Host:", default="localhost") or "localhost"
        port_str = ask_text("Port:", default="3306") or "3306"

        if not port_str.isdigit():
            raise InitError("Port must be a valid integer.")

        database = ask_text("Database name:", required_field=True)
        user = ask_text("Username:", required_field=True)
        password = ask_text("Password:", password=True) or ""
        schema_name = ask_text("Default schema (optional):")
        ssl_mode = cast(MysqlSslMode | None, ask_text("SSL mode (optional, e.g. REQUIRED, VERIFY_IDENTITY):") or None)

        return MysqlConfig(
            name=name,
            host=host,
            port=int(port_str),
            database=database,  # type: ignore[arg-type]
            user=user,  # type: ignore[arg-type]
            password=password,
            schema_name=schema_name,
            ssl_mode=ssl_mode,
        )

    def connect(self) -> BaseBackend:
        """Create an Ibis MySQL connection."""
        from nao_core.deps import require_database_backend

        require_database_backend("mysql")
        import ibis

        kwargs: dict[str, Any] = {
            "host": self.host,
            "port": self.port,
            "database": self.database,
            "user": self.user,
            "password": self.password,
        }

        if self.ssl_mode:
            kwargs["ssl_mode"] = self.ssl_mode

        ssl: dict[str, str] = {}
        if self.ssl_ca:
            ssl["ca"] = self.ssl_ca
        if self.ssl_cert:
            ssl["cert"] = self.ssl_cert
        if self.ssl_key:
            ssl["key"] = self.ssl_key
        if ssl:
            kwargs["ssl"] = ssl

        return ibis.mysql.connect(**kwargs)

    def get_database_name(self) -> str:
        return self.database

    def get_schemas(self, conn: BaseBackend) -> list[str]:
        if self.schema_name:
            return [self.schema_name]
        list_databases = getattr(conn, "list_databases", None)
        if list_databases:
            schemas = list_databases()
            return [s for s in schemas if s not in SYSTEM_SCHEMAS]
        return []

    def create_context(self, conn: BaseBackend, schema: str, table_name: str) -> MysqlDatabaseContext:
        return MysqlDatabaseContext(conn, schema, table_name)

    def check_connection(self) -> tuple[bool, str]:
        """Test connectivity to MySQL."""
        conn = None
        try:
            conn = self.connect()
            if self.schema_name:
                tables = conn.list_tables()
                return True, f"Connected successfully ({len(tables)} tables found)"
            if list_databases := getattr(conn, "list_databases", None):
                schemas = list_databases()
                return True, f"Connected successfully ({len(schemas)} schemas found)"
            return True, "Connected successfully"
        except Exception as e:
            return False, str(e)
        finally:
            if conn is not None:
                conn.disconnect()
