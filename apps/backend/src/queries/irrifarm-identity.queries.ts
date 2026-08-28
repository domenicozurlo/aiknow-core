import { and, eq } from 'drizzle-orm';

import s, { DBIrrifarmIdentity, NewIrrifarmIdentity, User } from '../db/abstractSchema';
import { db } from '../db/db';

export async function getUserByIrrifarmAccount(accountId: string): Promise<User | null> {
	const [result] = await db
		.select({ user: s.user })
		.from(s.account)
		.innerJoin(s.user, eq(s.user.id, s.account.userId))
		.where(and(eq(s.account.providerId, 'irrifarm'), eq(s.account.accountId, accountId)))
		.limit(1)
		.execute();
	return result?.user ?? null;
}

export async function upsertIrrifarmIdentity(identity: NewIrrifarmIdentity): Promise<void> {
	await db
		.insert(s.irrifarmIdentity)
		.values(identity)
		.onConflictDoUpdate({
			target: s.irrifarmIdentity.userId,
			set: {
				irrifarmUserId: identity.irrifarmUserId,
				username: identity.username,
				clientId: identity.clientId,
				clientLevel: identity.clientLevel,
				userRole: identity.userRole,
				regId: identity.regId,
				mboSns: identity.mboSns,
				lastValidatedAt: identity.lastValidatedAt,
				updatedAt: new Date(),
			},
		})
		.execute();
}

export async function getIrrifarmIdentity(userId: string): Promise<DBIrrifarmIdentity | null> {
	const [identity] = await db
		.select()
		.from(s.irrifarmIdentity)
		.where(eq(s.irrifarmIdentity.userId, userId))
		.limit(1)
		.execute();
	return identity ?? null;
}

export async function getAllowedMboSns(userId: string): Promise<string[] | null> {
	const identity = await getIrrifarmIdentity(userId);
	return identity?.mboSns ?? null;
}
