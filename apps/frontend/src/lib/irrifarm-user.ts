const IRRIFARM_SYNTHETIC_EMAIL = /^irrifarm-(\d+)@users\.invalid$/i;

export function getIrrifarmAccountId(email: string | null | undefined): string | null {
	return email?.match(IRRIFARM_SYNTHETIC_EMAIL)?.[1] ?? null;
}

export function getAccountDisplayLabel(email: string | null | undefined): string | undefined {
	if (!email) {
		return undefined;
	}
	const accountId = getIrrifarmAccountId(email);
	return accountId ? `Irrifarm account · ID ${accountId}` : email;
}

export function getDeliverableEmail(email: string | null | undefined): string | undefined {
	return getIrrifarmAccountId(email) ? undefined : (email ?? undefined);
}
