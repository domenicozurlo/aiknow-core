import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { decodeJwt } from 'jose';

import { IrrifarmApiClient } from '../src/services/irrifarm-api.client';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(scriptDirectory, '..', '..', '..', '.env') });

const baseUrl = required('IRRIFARM_BASE_URL');
const username = required('IRRIFARM_TEST_USERNAME');
const password = required('IRRIFARM_TEST_PASSWORD');
const clientId = requiredPositiveInt('IRRIFARM_TEST_CLIENT_ID');
const userId = requiredPositiveInt('IRRIFARM_TEST_USER_ID');
const clientLevel = requiredPositiveInt('IRRIFARM_TEST_CLIENT_LEVEL');
const regId = process.env.IRRIFARM_TEST_REG_ID?.trim();

const client = new IrrifarmApiClient({ baseUrl });
const token = await client.createAppToken(username, password);
const claims = decodeJwt(token);
console.log(`JWT generated for subject: ${claims.sub ?? '<missing>'}`);

if (regId) {
	const checked = await client.checkUser({ token, username, regId });
	console.log(
		`CheckUser: active=${checked.active}, userId=${checked.userId}, clientId=${checked.userClientId}, clientLevel=${checked.userClientLevel}`,
	);
} else {
	console.log('CheckUser skipped: IRRIFARM_TEST_REG_ID is not configured.');
}

const motherBoards = await client.getMotherBoardsByClient({ token, clientId, userId, clientLevel });
const serials = [...new Set(motherBoards.map((motherBoard) => motherBoard.mboSn).filter(Boolean))];
console.log(`GetMotherBoardsByClient: ${motherBoards.length} rows, ${serials.length} distinct MBO serials.`);
if (process.env.IRRIFARM_TEST_SHOW_SERIALS === 'true') {
	console.log(`First serials: ${serials.slice(0, 10).join(', ') || '<none>'}`);
}

function required(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`${name} is required.`);
	}
	return value;
}

function requiredPositiveInt(name: string): number {
	const value = Number(required(name));
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer.`);
	}
	return value;
}
