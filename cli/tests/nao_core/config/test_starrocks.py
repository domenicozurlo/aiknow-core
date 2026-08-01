import sys
import types

from nao_core.config.databases.starrocks import StarRocksConfig


class DummyConn:
    def list_catalogs(self):
        return ["default_catalog", "hive1"]

    def list_databases(self, catalog: str):
        return {
            "default_catalog": ["information_schema", "sales"],
            "hive1": ["analytics"],
        }[catalog]


def test_starrocks_get_schemas_without_explicit_schema():
    cfg = StarRocksConfig(name="sr", host="localhost", user="root", catalog=None)
    schemas = cfg.get_schemas(DummyConn())
    assert schemas == ["default_catalog.sales", "hive1.analytics"]


def test_starrocks_matches_pattern_accepts_catalog_and_schema_forms():
    cfg = StarRocksConfig(
        name="sr",
        host="localhost",
        user="root",
        catalog="default_catalog",
        include=["default_catalog.sales.*"],
        exclude=["sales.orders"],
    )

    assert cfg.matches_pattern("default_catalog.sales", "users") is True
    assert cfg.matches_pattern("default_catalog.sales", "orders") is False


def test_starrocks_get_database_name_variants():
    both = StarRocksConfig(name="sr", host="localhost", user="root", catalog="hive1", database="analytics")
    catalog_only = StarRocksConfig(name="sr", host="localhost", user="root", catalog="hive1")
    fallback = StarRocksConfig(name="sr", host="localhost", user="root")

    assert both.get_database_name() == "hive1.analytics"
    assert catalog_only.get_database_name() == "hive1"
    assert fallback.get_database_name() == "starrocks"


def test_starrocks_connect_uses_tls(monkeypatch):
    captured = {}

    def fake_connect(**kwargs):
        captured.update(kwargs)
        return object()

    mysql_module = types.ModuleType("mysql")
    connector_module = types.ModuleType("mysql.connector")
    setattr(connector_module, "connect", fake_connect)
    setattr(mysql_module, "connector", connector_module)

    monkeypatch.setitem(sys.modules, "mysql", mysql_module)
    monkeypatch.setitem(sys.modules, "mysql.connector", connector_module)

    cfg = StarRocksConfig(name="sr", host="localhost", user="root")
    cfg.connect()

    assert captured["ssl_disabled"] is False
