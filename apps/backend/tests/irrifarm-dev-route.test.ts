import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { irrifarmDevRoutes, renderIrrifarmSsoTestPage } from '../src/routes/irrifarm-dev';

describe('Irrifarm development test page', () => {
	let app: FastifyInstance;

	beforeEach(async () => {
		app = Fastify();
		await app.register(irrifarmDevRoutes, { prefix: '/api/auth/irrifarm' });
		await app.ready();
	});

	afterEach(async () => {
		await app.close();
	});

	it('serves a non-cacheable form that posts to the real sign-in endpoint', async () => {
		const response = await app.inject({ method: 'GET', url: '/api/auth/irrifarm/test' });

		expect(response.statusCode).toBe(200);
		expect(response.headers['cache-control']).toBe('no-store');
		expect(response.headers['content-security-policy']).toContain("form-action 'self'");
		expect(response.body).toContain('action="/api/auth/sign-in/irrifarm"');
		expect(response.body).toContain('name="referrer" content="strict-origin"');
		expect(response.body).toContain('name="token"');
		expect(response.body).not.toContain('name="password"');
	});

	it('escapes values rendered from configuration', () => {
		const page = renderIrrifarmSsoTestPage('fixture<script>', 'user"><script>');

		expect(page).not.toContain('fixture<script>');
		expect(page).not.toContain('user"><script>');
		expect(page).toContain('fixture&lt;script&gt;');
		expect(page).toContain('user&quot;&gt;&lt;script&gt;');
	});
});
