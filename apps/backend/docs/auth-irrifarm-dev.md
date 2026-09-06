# Test Irrifarm SSO in dev

NAO dev: <https://app-irriai-weu-test-hxghdvhfdsg5fvdx.westeurope-01.azurewebsites.net>

## Configurazione

Impostare queste variabili nell'App Service di NAO dev:

```env
BETTER_AUTH_URL=https://app-irriai-weu-test-hxghdvhfdsg5fvdx.westeurope-01.azurewebsites.net

IRRIFARM_BASE_URL=https://app-irrifarm-service-weu-test-ftd7crece2dxfzga.westeurope-01.azurewebsites.net
IRRIFARM_AUTH_MODE=fixture
IRRIFARM_TEST_PAGE_ENABLED=true
IRRIFARM_REQUEST_TIMEOUT_MS=10000

IRRIFARM_FIXTURE_USERNAME=domenico
IRRIFARM_FIXTURE_USER_ID=470
IRRIFARM_FIXTURE_CLIENT_ID=204
IRRIFARM_FIXTURE_CLIENT_LEVEL=20

IRRIFARM_MBO_SCOPE_COLUMNS={"motherboards":"MBO_SN","senshistory":"MBO_SN","proghistory":"MboSn"}
IRRIFARM_MBO_UNSCOPED_TABLES=products
IRRIFARM_LARGE_SCOPE_THRESHOLD=50
IRRIFARM_MAX_QUERY_ROWS=500
IRRIFARM_QUERY_TIMEOUT_MS=30000
```

`BETTER_AUTH_SECRET` deve essere gia' configurato e stabile: non rigenerarlo durante il test. Anche `NAO_DEFAULT_PROJECT_PATH` e la configurazione del database Irrifarm devono essere gia' disponibili al backend e al sidecar FastAPI.

Se il POST di hand-off parte dal frontend Irrifarm anziche' dalla pagina di test NAO, aggiungere il suo origin esatto (senza path):

```env
IRRIFARM_APP_ORIGINS=https://<frontend-irrifarm-dev>
```

Non configurare password Irrifarm o JWT come variabili permanenti.

## Prova rapida

1. Generare un JWT Irrifarm per `domenico` tramite `apptokenreg`.
2. Aprire <https://app-irriai-weu-test-hxghdvhfdsg5fvdx.westeurope-01.azurewebsites.net/api/auth/irrifarm/test>.
3. Inserire username `domenico`, incollare il JWT e inviare il form. In modalita' `fixture` il `regId` va lasciato vuoto.
4. Verificare in Account che l'utente sia `Irrifarm account - ID 470`.
5. Chiedere in chat: `Dammi la tabella giornaliera della pressione in linea a gennaio 2025.`
6. Il risultato deve contenere soltanto gli MBO autorizzati a Domenico; nel dataset di test corrente e' `IRRIFT0000990521`. L'utente non deve indicare il seriale.

Al termine del collaudo impostare `IRRIFARM_TEST_PAGE_ENABLED=false` e invalidare le sessioni/token di test con il logout.

## Passaggio a CheckUser

Quando Irrifarm fornira' un `regId` reale:

```env
IRRIFARM_AUTH_MODE=check-user
```

Rimuovere le quattro variabili `IRRIFARM_FIXTURE_*`. Il form dell'app Irrifarm dovra' inviare nel body POST `token`, `username` e `regId`; NAO ricavera' `userId`, `clientId` e `clientLevel` da `CheckUser` e aggiornera' lo scope MBO a ogni accesso.
