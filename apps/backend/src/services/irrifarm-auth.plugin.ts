import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { z } from 'zod/v4';

import { env } from '../env';
import * as accountQueries from '../queries/account.queries';
import * as irrifarmIdentityQueries from '../queries/irrifarm-identity.queries';
import * as organizationQueries from '../queries/organization.queries';
import * as userQueries from '../queries/user.queries';
import { IrrifarmApiClient, IrrifarmApiError } from './irrifarm-api.client';
import {
	createIrrifarmAuthConfigFromEnv,
	IrrifarmAuthError,
	IrrifarmAuthService,
	type IrrifarmResolvedIdentity,
} from './irrifarm-auth.service';

const PROVIDER_ID = 'irrifarm';

const signInBodySchema = z.object({
	token: z.string().min(1).max(16_384),
	username: z.string().min(1).max(255),
	regId: z.uuid().optional(),
});

export function augmentPluginsWithIrrifarm(plugins: BetterAuthPlugin[]): void {
	const config = createIrrifarmAuthConfigFromEnv();
	if (!config) {
		return;
	}

	const client = new IrrifarmApiClient({
		baseUrl: env.IRRIFARM_BASE_URL!,
		timeoutMs: env.IRRIFARM_REQUEST_TIMEOUT_MS,
	});
	plugins.push(createIrrifarmAuthPlugin(new IrrifarmAuthService(client, config)));
}

export function createIrrifarmAuthPlugin(service: IrrifarmAuthService): BetterAuthPlugin {
	return {
		id: PROVIDER_ID,
		endpoints: {
			signInIrrifarm: createAuthEndpoint(
				'/sign-in/irrifarm',
				{
					method: 'POST',
					body: signInBodySchema,
				},
				async (ctx) => {
					let identity: IrrifarmResolvedIdentity;
					try {
						identity = await service.resolve(ctx.body);
					} catch (error) {
						if (error instanceof IrrifarmAuthError || error instanceof IrrifarmApiError) {
							throw new APIError('UNAUTHORIZED', { message: error.message });
						}
						throw error;
					}

					const accountId = String(identity.userId);
					let user = await irrifarmIdentityQueries.getUserByIrrifarmAccount(accountId);
					if (!user) {
						const email = `irrifarm-${identity.userId}@users.invalid`;
						user = await userQueries.getUser({ email });
						if (!user) {
							const createdUser = await ctx.context.internalAdapter.createUser({
								name: identity.username,
								email,
								emailVerified: true,
								createdAt: new Date(),
								updatedAt: new Date(),
							});
							user = createdUser ? await userQueries.getUser({ id: createdUser.id }) : null;
						}
						if (!user) {
							throw new APIError('INTERNAL_SERVER_ERROR', { message: 'Could not create the nao user.' });
						}
						if (!(await accountQueries.hasAccountForProvider(user.id, PROVIDER_ID))) {
							const account = await ctx.context.internalAdapter.createAccount({
								providerId: PROVIDER_ID,
								accountId,
								userId: user.id,
							});
							if (!account) {
								throw new APIError('INTERNAL_SERVER_ERROR', {
									message: 'Could not link the Irrifarm account.',
								});
							}
						}
					}
					await organizationQueries.addUserToDefaultProjectIfExists(user.id);
					await irrifarmIdentityQueries.upsertIrrifarmIdentity({
						userId: user.id,
						irrifarmUserId: identity.userId,
						username: identity.username,
						clientId: identity.clientId,
						clientLevel: identity.clientLevel,
						userRole: identity.userRole,
						regId: identity.regId,
						mboSns: identity.mboSns,
						lastValidatedAt: new Date(),
					});

					const session = await ctx.context.internalAdapter.createSession(user.id);
					if (!session) {
						throw new APIError('INTERNAL_SERVER_ERROR', { message: 'Could not create the nao session.' });
					}
					await setSessionCookie(ctx, { session, user });
					throw ctx.redirect(new URL('/', env.BETTER_AUTH_URL).toString());
				},
			),
		},
	};
}
