function serializeBody(body: unknown, contentType: string | undefined): string | undefined {
	if (!body) {
		return undefined;
	}
	if (contentType?.includes('application/x-www-form-urlencoded') && typeof body === 'object') {
		return new URLSearchParams(body as Record<string, string>).toString();
	}
	return JSON.stringify(body);
}

export function normalizeAuthRequestPayload(input: {
	method: string;
	url: string;
	contentType: string | undefined;
	body: unknown;
}): { contentType: string | undefined; body: string | undefined } {
	const isIrrifarmFormPost =
		input.method === 'POST' &&
		input.url === '/api/auth/sign-in/irrifarm' &&
		input.contentType?.includes('application/x-www-form-urlencoded');
	return {
		contentType: isIrrifarmFormPost ? 'application/json' : input.contentType,
		body: isIrrifarmFormPost ? JSON.stringify(input.body) : serializeBody(input.body, input.contentType),
	};
}
