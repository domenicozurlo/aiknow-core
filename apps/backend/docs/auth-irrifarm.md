# Irrifarm application hand-off

This integration lets an authenticated Irrifarm user open nao without seeing nao's login page. It does not change or replace Irrifarm's existing username/password login.

## Browser hand-off

The Irrifarm backend obtains an Irrifarm app JWT and returns an auto-submitting form to the browser. Passwords must never be sent to nao.

```html
<form method="post" action="https://nao.example.com/api/auth/sign-in/irrifarm">
	<input type="hidden" name="token" value="IRRIFARM_JWT" />
	<input type="hidden" name="username" value="vincenzo" />
	<!-- Required once IRRIFARM_AUTH_MODE=check-user -->
	<input type="hidden" name="regId" value="DEVICE_UUID" />
</form>
<script>
	document.forms[0].submit();
</script>
```

The endpoint validates the Irrifarm identity, fetches its authorized motherboards, creates or finds the linked nao user, sets the normal Better Auth session cookie, and redirects to `/`.

In local development, open `http://localhost:3000/api/auth/irrifarm/test` through the Vite proxy to use a development-only form instead of creating the hand-off form manually. Paste the JWT, confirm the username, and submit it. The page is not registered when `MODE=prod`.

The JWT, username, or IDs must not be placed in the URL. Configure the Irrifarm application origin in `IRRIFARM_APP_ORIGINS` so Better Auth can enforce its origin check.

## Validation modes

`IRRIFARM_AUTH_MODE=fixture` is the temporary test path. It only accepts the configured fixture username. The JWT is still validated remotely by calling `GetMotherBoardsByClient`; only `CheckUser` is skipped.

```env
IRRIFARM_BASE_URL=https://app-irrifarm-service.example
IRRIFARM_AUTH_MODE=fixture
IRRIFARM_FIXTURE_USERNAME=domenico
IRRIFARM_FIXTURE_USER_ID=470
IRRIFARM_FIXTURE_CLIENT_ID=204
IRRIFARM_FIXTURE_CLIENT_LEVEL=20
```

`IRRIFARM_AUTH_MODE=check-user` is the final path. `regId` is mandatory and nao requires `CheckUser.active=true`. The returned values are mapped as follows:

| CheckUser         | GetMotherBoardsByClient |
| ----------------- | ----------------------- |
| `userClientId`    | `Client_Id`             |
| `userId`          | `USR_Id`                |
| `userClientLevel` | `IdClientLevel`         |

## SQL scope policy

Authorized MBO serials are stored server-side and sent to the Python query sidecar. The sidecar rewrites every configured physical table into an MBO-scoped subquery. It rejects unclassified tables for Irrifarm users.

The FastAPI sidecar must remain reachable only by the trusted nao backend: external callers must not be able to omit or replace `allowed_mbo_sns`.

```env
IRRIFARM_MBO_SCOPE_COLUMNS={"motherboards":"MBO_SN","senshistory":"MBO_SN","proghistory":"MboSn"}
IRRIFARM_MBO_UNSCOPED_TABLES=products
```

The mapping must include every queryable Irrifarm data table. Add only genuinely global, non-customer-specific tables to the unscoped allowlist.

## API smoke test

The smoke command generates a JWT, optionally runs `CheckUser`, and calls `GetMotherBoardsByClient`. It never prints the JWT or password.

```powershell
$env:IRRIFARM_TEST_USERNAME='domenico'
$env:IRRIFARM_TEST_PASSWORD='...'
$env:IRRIFARM_TEST_USER_ID='470'
$env:IRRIFARM_TEST_CLIENT_ID='204'
$env:IRRIFARM_TEST_CLIENT_LEVEL='20'
npm.cmd run -w @nao/backend irrifarm:smoke
```

Set `IRRIFARM_TEST_REG_ID` to include `CheckUser` in the smoke test. Test credentials must stay outside committed files.
