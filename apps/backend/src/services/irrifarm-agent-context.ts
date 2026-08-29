export function appendIrrifarmAuthorizationContext(
	prompt: string,
	allowedMboSns: string[] | null,
	options: { largeScopeThreshold?: number } = {},
): string {
	if (allowedMboSns === null) {
		return prompt;
	}

	const serials = [...new Set(allowedMboSns)];
	const scopeInstructions = buildScopeInstructions(serials, options.largeScopeThreshold ?? 50);
	return `${prompt}\n\n## Irrifarm authorization scope\n\n${scopeInstructions}`;
}

function buildScopeInstructions(serials: string[], largeScopeThreshold: number): string {
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

	if (serials.length > largeScopeThreshold) {
		return [
			`The authenticated Irrifarm user has a large authorization scope of ${serials.length} MBO serials.`,
			'Interpret "my control units" and "of my competence" as the complete authorized set, but do not retrieve or enumerate every motherboard unless the user explicitly requests a full export.',
			'For inventory questions, start with COUNT(*) and grouped summaries. For discovery or selection, query at most 50 aliases/serials at a time and ask the user for an alias, customer, status, or other narrowing criterion.',
			'For telemetry or history tables such as senshistory, always use a bounded time interval and aggregate in SQL. If the user did not provide a time interval, ask for one before querying.',
			'When the request requires exactly one control unit, retrieve a small scoped set of matching aliases and serials, then ask the user to choose. Never load the complete MBO list merely to count it.',
			commonInstructions,
		].join(' ');
	}

	return [
		`The authenticated Irrifarm user has ${serials.length} authorized MBO serials.`,
		'Interpret expressions such as "my control units" or "of my competence" as the complete authorized set. Do not ask for a serial when the request can be run across that set; execute the query and let the SQL executor apply the scope.',
		'A singular expression such as "my control unit" is ambiguous when the task requires data for exactly one control unit.',
		'In that case, first retrieve the scoped list of authorized motherboards and their aliases from the available project context or SQL, then ask the user to choose from those options. Do not ask the user to provide an opaque serial without presenting the authorized choices.',
		commonInstructions,
	].join(' ');
}

function serializeOpaqueValue(value: string): string {
	return JSON.stringify(value).replace(/[<>&`]/g, (character) => {
		const codePoint = character.codePointAt(0)?.toString(16).padStart(4, '0');
		return `\\u${codePoint}`;
	});
}
