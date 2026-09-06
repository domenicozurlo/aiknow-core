import { z } from 'zod/v4';

const checkUserSchema = z.object({
	active: z.boolean(),
	userRole: z.string().nullable().optional(),
	userClientId: z.number().int(),
	userClientLevel: z.number().int(),
	userId: z.number().int(),
	regId: z.uuid(),
});

const motherBoardSchema = z.object({
	mboSn: z.string().nullable(),
	mboAlias: z.string().nullable().optional(),
	prdTitle: z.string().nullable().optional(),
	mboProgressive: z.string().nullable().optional(),
	ssId: z.string().nullable().optional(),
	ip: z.string().nullable().optional(),
	location: z.string().nullable().optional(),
	cityId: z.number().int().optional(),
	longitude: z.string().nullable().optional(),
	latitude: z.string().nullable().optional(),
	stato: z.number().int().optional(),
});

const motherBoardsSchema = z.array(motherBoardSchema);

export type IrrifarmCheckUser = z.infer<typeof checkUserSchema>;
export type IrrifarmMotherBoard = z.infer<typeof motherBoardSchema>;

export interface IrrifarmApiClientOptions {
	baseUrl: string;
	timeoutMs?: number;
	fetch?: typeof globalThis.fetch;
}

export class IrrifarmApiError extends Error {
	constructor(
		message: string,
		public readonly status?: number,
	) {
		super(message);
		this.name = 'IrrifarmApiError';
	}
}

export class IrrifarmApiClient {
	private readonly baseUrl: string;
	private readonly timeoutMs: number;
	private readonly request: typeof globalThis.fetch;

	constructor(options: IrrifarmApiClientOptions) {
		this.baseUrl = options.baseUrl.replace(/\/+$/, '');
		this.timeoutMs = options.timeoutMs ?? 10_000;
		this.request = options.fetch ?? globalThis.fetch;
	}

	async createAppToken(username: string, password: string): Promise<string> {
		const body = new FormData();
		body.set('username', username);
		body.set('password', password);

		const response = await this.post('/api/Token/apptokenreg', body);
		const raw = await response.text();
		const token = parseTokenResponse(raw);
		if (token.split('.').length !== 3) {
			throw new IrrifarmApiError('Irrifarm returned an invalid JWT response.', response.status);
		}
		return token;
	}

	async checkUser(input: { token: string; username: string; regId: string }): Promise<IrrifarmCheckUser> {
		const body = new FormData();
		body.set('username', input.username);
		body.set('RegId', input.regId);

		const response = await this.post('/api/Service/CheckUser', body, input.token);
		return parseJsonResponse(response, checkUserSchema, 'CheckUser');
	}

	async getMotherBoardsByClient(input: {
		token: string;
		clientId: number;
		userId: number;
		clientLevel: number;
	}): Promise<IrrifarmMotherBoard[]> {
		const body = new FormData();
		body.set('Client_Id', String(input.clientId));
		body.set('USR_Id', String(input.userId));
		body.set('IdClientLevel', String(input.clientLevel));

		const response = await this.post('/api/Service/GetMotherBoardsByClient', body, input.token);
		return parseJsonResponse(response, motherBoardsSchema, 'GetMotherBoardsByClient');
	}

	private async post(path: string, body: FormData, token?: string): Promise<Response> {
		const headers = new Headers({ Accept: 'application/json' });
		if (token) {
			headers.set('Authorization', `Bearer ${token}`);
		}

		let response: Response;
		try {
			response = await this.request(`${this.baseUrl}${path}`, {
				method: 'POST',
				headers,
				body,
				signal: AbortSignal.timeout(this.timeoutMs),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new IrrifarmApiError(`Irrifarm request failed: ${message}`);
		}

		if (!response.ok) {
			throw new IrrifarmApiError(`Irrifarm request failed with HTTP ${response.status}.`, response.status);
		}
		return response;
	}
}

async function parseJsonResponse<T>(response: Response, schema: z.ZodType<T>, operation: string): Promise<T> {
	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		throw new IrrifarmApiError(`Irrifarm ${operation} returned invalid JSON.`, response.status);
	}

	const parsed = schema.safeParse(payload);
	if (!parsed.success) {
		throw new IrrifarmApiError(`Irrifarm ${operation} returned an unexpected response.`, response.status);
	}
	return parsed.data;
}

function parseTokenResponse(raw: string): string {
	const trimmed = raw.trim();
	try {
		const parsed = JSON.parse(trimmed) as unknown;
		if (typeof parsed === 'string') {
			return parsed;
		}
		if (parsed && typeof parsed === 'object') {
			const record = parsed as Record<string, unknown>;
			const value = record.token ?? record.access_token;
			if (typeof value === 'string') {
				return value;
			}
		}
	} catch {
		// Some Irrifarm deployments return the compact JWT as plain text.
	}
	return trimmed.replace(/^"|"$/g, '');
}
