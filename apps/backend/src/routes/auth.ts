import { App } from '../app';
import { getAuth } from '../auth';
import { normalizeAuthRequestPayload } from '../utils/auth-request';
import { convertHeaders } from '../utils/utils';

export const authRoutes = async (app: App) => {
	app.route({
		method: ['GET', 'POST'],
		url: '/auth/*',
		async handler(request, reply) {
			try {
				// Construct request URL
				const url = new URL(request.url, `http://${request.headers.host}`);

				const headers = convertHeaders(request.headers);
				const payload = normalizeAuthRequestPayload({
					method: request.method,
					url: request.url,
					contentType: request.headers['content-type'],
					body: request.body,
				});
				if (payload.contentType) {
					headers.set('content-type', payload.contentType);
				}
				// Create Fetch API-compatible request
				const req = new Request(url.toString(), {
					method: request.method,
					headers,
					body: payload.body,
				});
				// Process authentication request
				const auth = await getAuth();
				const response = await auth.handler(req);
				// Forward response to client
				reply.status(response.status);
				response.headers.forEach((value, key) => reply.header(key, value));
				reply.send(response.body ? await response.text() : null);
			} catch (error) {
				app.log.error(error, 'Authentication Error');
				reply.status(500).send({
					error: 'Internal authentication error',
					code: 'AUTH_FAILURE',
				});
			}
		},
	});
};
