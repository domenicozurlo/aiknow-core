from typing import cast
from unittest.mock import MagicMock, patch

from nao_core.config.databases.mysql import MysqlConfig, MysqlSslMode


def test_connect_forwards_tls_options() -> None:
    mock_connect = MagicMock()
    cfg = MysqlConfig(
        name="mysql-prod",
        host="mysql.example.com",
        port=3306,
        database="app",
        user="alice",
        password="secret",
        ssl_mode=cast(MysqlSslMode, "required"),
        ssl_ca="/etc/ssl/certs/mysql-ca.pem",
    )

    with (
        patch("nao_core.deps.require_database_backend"),
        patch("ibis.mysql.connect", mock_connect),
    ):
        cfg.connect()

    mock_connect.assert_called_once()
    call_kw = mock_connect.call_args.kwargs
    assert call_kw["host"] == "mysql.example.com"
    assert call_kw["database"] == "app"
    assert call_kw["ssl_mode"] == "REQUIRED"
    assert call_kw["ssl"] == {"ca": "/etc/ssl/certs/mysql-ca.pem"}


def test_connect_omits_tls_options_by_default() -> None:
    mock_connect = MagicMock()
    cfg = MysqlConfig(
        name="mysql-local",
        host="localhost",
        database="app",
        user="root",
        password="secret",
    )

    with (
        patch("nao_core.deps.require_database_backend"),
        patch("ibis.mysql.connect", mock_connect),
    ):
        cfg.connect()

    call_kw = mock_connect.call_args.kwargs
    assert "ssl_mode" not in call_kw
    assert "ssl" not in call_kw
