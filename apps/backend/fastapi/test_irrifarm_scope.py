import pytest

from irrifarm_scope import IrrifarmScopeError, apply_irrifarm_scope


POLICY = {"motherboards": "MBO_SN", "senshistory": "MBO_SN"}


def test_scopes_a_table_and_preserves_its_alias():
    sql = apply_irrifarm_scope(
        "SELECT m.MBO_SN, m.MBO_Alias FROM motherboards m",
        ["SN002", "SN001"],
        "mysql",
        POLICY,
    )

    assert (
        "FROM (SELECT * FROM motherboards WHERE MBO_SN IN ('SN001', 'SN002')) AS m"
        in sql
    )


def test_scopes_every_table_in_a_join():
    sql = apply_irrifarm_scope(
        "SELECT s.MBO_SN FROM senshistory s JOIN motherboards m ON m.MBO_SN = s.MBO_SN",
        ["SN001"],
        "mysql",
        POLICY,
    )

    assert sql.count("MBO_SN IN ('SN001')") == 2


def test_empty_access_list_returns_no_rows_from_scoped_sources():
    sql = apply_irrifarm_scope("SELECT * FROM motherboards", [], "mysql", POLICY)

    assert "WHERE FALSE" in sql


def test_rejects_an_unclassified_table():
    with pytest.raises(IrrifarmScopeError, match="no Irrifarm MBO scope rule"):
        apply_irrifarm_scope("SELECT * FROM users", ["SN001"], "mysql", POLICY)


def test_allows_an_explicit_global_table():
    sql = apply_irrifarm_scope(
        "SELECT * FROM products", ["SN001"], "mysql", POLICY, {"products"}
    )

    assert sql == "SELECT * FROM products"


def test_rejects_non_select_statements():
    with pytest.raises(IrrifarmScopeError, match="Only SELECT"):
        apply_irrifarm_scope("DELETE FROM motherboards", ["SN001"], "mysql", POLICY)
