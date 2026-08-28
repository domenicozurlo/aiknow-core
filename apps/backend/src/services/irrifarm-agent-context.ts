export function appendIrrifarmAuthorizationContext(prompt: string, allowedMboSns: string[] | null): string {
	if (allowedMboSns === null) {
		return prompt;
	}

	const serials = [...new Set(allowedMboSns)];
	const scopeInstructions = buildScopeInstructions(serials);
	return `${prompt}\n\n## Irrifarm authorization scope\n\n${scopeInstructions}`;
}

function buildScopeInstructions(serials: string[]): string {
	const commonInstructions =
		'The SQL executor enforces this authorization scope server-side. Never request, infer, or use an MBO outside it.';

	if (serials.length === 0) {
		return `The authenticated Irrifarm user has no authorized MBO serials. Do not claim that customer data is available. ${commonInstructions}`;
	}

	if (serials.length === 1) {
		return [
			`The authenticated Irrifarm user has exactly one authorized MBO_SN: ${serializeOpaqueValue(serials[0])}.`,
			'Interpret expressions such as "my control unit", "my MBO", or "of my competence" as this serial. Do not ask the user to provide it again.',
			commonInstructions,
		].join(' ');
	}

	return [
		`The authenticated Irrifarm user has ${serials.length} authorized MBO serials.`,
		'Interpret expressions such as "my control units" or "of my competence" as the complete authorized set. Do not ask for a serial when the request can be run across that set; execute the query and let the SQL executor apply the scope.',
		'Ask which MBO only when the task genuinely requires exactly one control unit.',
		commonInstructions,
	].join(' ');
}

function serializeOpaqueValue(value: string): string {
	return JSON.stringify(value).replace(/[<>&`]/g, (character) => {
		const codePoint = character.codePointAt(0)?.toString(16).padStart(4, '0');
		return `\\u${codePoint}`;
	});
}
