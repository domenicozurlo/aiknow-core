import type { App } from '../app';
import { env } from '../env';

export const irrifarmDevRoutes = async (app: App) => {
	app.get('/test', async (_request, reply) => {
		reply
			.header('Cache-Control', 'no-store')
			.header('Pragma', 'no-cache')
			.header('X-Content-Type-Options', 'nosniff')
			.header(
				'Content-Security-Policy',
				"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
			)
			.type('text/html; charset=utf-8')
			.send(renderIrrifarmSsoTestPage(env.IRRIFARM_AUTH_MODE, env.IRRIFARM_FIXTURE_USERNAME));
	});
};

export function renderIrrifarmSsoTestPage(mode: string, fixtureUsername?: string): string {
	const username = escapeHtml(fixtureUsername ?? '');
	const authMode = escapeHtml(mode);

	return `<!doctype html>
<html lang="it">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<meta name="referrer" content="strict-origin" />
		<title>Test Irrifarm → NAO</title>
		<style>
			:root { color-scheme: light dark; font-family: system-ui, sans-serif; }
			body { margin: 0; padding: 2rem; background: #f4f7f5; color: #17221c; }
			main { max-width: 42rem; margin: 0 auto; padding: 2rem; border: 1px solid #cbd8d0; border-radius: 12px; background: white; box-shadow: 0 8px 28px #17221c18; }
			h1 { margin-top: 0; font-size: 1.5rem; }
			p { line-height: 1.5; }
			.mode { display: inline-block; padding: .2rem .55rem; border-radius: 999px; background: #e3f3e8; font-family: ui-monospace, monospace; }
			label { display: block; margin-top: 1rem; font-weight: 650; }
			input, textarea { box-sizing: border-box; width: 100%; margin-top: .4rem; padding: .7rem; border: 1px solid #aebdb4; border-radius: 6px; background: white; color: #17221c; font: inherit; }
			textarea { min-height: 11rem; resize: vertical; font-family: ui-monospace, monospace; font-size: .8rem; }
			button { margin-top: 1.25rem; padding: .75rem 1rem; border: 0; border-radius: 6px; background: #168548; color: white; font: inherit; font-weight: 700; cursor: pointer; }
			.note { margin-bottom: 0; color: #536158; font-size: .9rem; }
		</style>
	</head>
	<body>
		<main>
			<h1>Test accesso Irrifarm → NAO</h1>
			<p>Modalità backend: <span class="mode">${authMode}</span></p>
			<form method="post" action="/api/auth/sign-in/irrifarm" autocomplete="off">
				<label for="username">Username Irrifarm</label>
				<input id="username" name="username" value="${username}" required maxlength="255" />

				<label for="token">JWT Irrifarm</label>
				<textarea id="token" name="token" required maxlength="16384" spellcheck="false" autocomplete="off"></textarea>

				<label for="regId">RegId <small>(necessario solo in modalità check-user)</small></label>
				<input id="regId" name="regId" placeholder="UUID del dispositivo" autocomplete="off" />

				<button type="submit">Entra in NAO</button>
			</form>
			<p class="note">La pagina non richiede né memorizza la password Irrifarm. Il JWT viene inviato nel body POST e la risposta non viene salvata in cache.</p>
		</main>
		<script>
			const form = document.querySelector('form');
			const token = document.querySelector('#token');
			const usernameInput = document.querySelector('#username');
			const regId = document.querySelector('#regId');
			form.addEventListener('submit', () => {
				token.value = token.value.trim();
				usernameInput.value = usernameInput.value.trim();
				regId.value = regId.value.trim();
				if (!regId.value) regId.disabled = true;
			});
		</script>
	</body>
</html>`;
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>'"]/g, (character) => {
		const entities: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			"'": '&#39;',
			'"': '&quot;',
		};
		return entities[character];
	});
}
