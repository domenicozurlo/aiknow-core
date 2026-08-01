import fs from 'node:fs';
import path from 'node:path';

import type { LlmProvider } from '@nao/shared/types';
import yaml from 'js-yaml';

import type { LinkedContextRepo } from '../types/context-recommendation';
import { logger } from './logger';

const ENV_PATTERN = /\$?\{\{\s*env\(['"]([^'"]+)['"]\)\s*\}\}/g;
const OPENAI_REASONING_EFFORTS = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']);
const AZURE_REASONING_EFFORTS = new Set(['low', 'medium', 'high']);

export type LlmProviderRuntimeOptions = {
	reasoningEffort?: string;
};

export function extractRequiredEnvVars(projectFolder: string): string[] {
	const configPath = path.join(projectFolder, 'nao_config.yaml');
	if (!fs.existsSync(configPath)) {
		return [];
	}

	const content = fs.readFileSync(configPath, 'utf-8');
	const vars = new Set<string>();

	for (const match of content.matchAll(ENV_PATTERN)) {
		vars.add(match[1]);
	}

	return [...vars];
}

export function extractConfiguredRepos(projectFolder: string): LinkedContextRepo[] {
	const configPath = path.join(projectFolder, 'nao_config.yaml');
	if (!fs.existsSync(configPath)) {
		return [];
	}

	const config = loadConfig(configPath);
	if (!isRecord(config) || !Array.isArray(config.repos)) {
		return [];
	}

	return config.repos.flatMap((repo) => {
		if (!isRecord(repo) || typeof repo.name !== 'string' || repo.name.trim() === '') {
			return [];
		}

		const url = typeof repo.url === 'string' && repo.url.trim() !== '' ? repo.url.trim() : null;
		const branch = typeof repo.branch === 'string' && repo.branch.trim() !== '' ? repo.branch.trim() : null;
		const localPath =
			typeof repo.local_path === 'string' && repo.local_path.trim() !== '' ? repo.local_path.trim() : null;

		return [
			{
				name: repo.name.trim(),
				contextPath: `repos/${repo.name.trim()}`,
				url,
				branch,
				localPath,
				repoFullName: url ? parseGithubRepoFullName(url) : null,
			},
		];
	});
}

export function extractLlmProviderOptions(projectFolder: string, provider: LlmProvider): LlmProviderRuntimeOptions {
	const configPath = path.join(projectFolder, 'nao_config.yaml');
	if (!fs.existsSync(configPath)) {
		return {};
	}

	const config = loadConfig(configPath);
	if (!isRecord(config)) {
		return {};
	}

	const llm = getRecord(config, 'llm');
	if (!llm) {
		return {};
	}

	const reasoningEffort =
		readString(getRecord(llm, 'providers')?.[provider], 'reasoning_effort') ??
		readString(getRecord(llm, 'providers')?.[provider], 'reasoningEffort') ??
		readString(getRecord(llm, provider), 'reasoning_effort') ??
		readString(getRecord(llm, provider), 'reasoningEffort') ??
		readString(llm, 'reasoning_effort') ??
		readString(llm, 'reasoningEffort');

	if (!reasoningEffort) {
		return {};
	}

	return isReasoningEffortAllowed(provider, reasoningEffort, configPath) ? { reasoningEffort } : {};
}

function loadConfig(configPath: string): unknown {
	try {
		return yaml.load(fs.readFileSync(configPath, 'utf-8'));
	} catch (err) {
		logger.warn(`Failed to read or parse ${configPath}: ${err instanceof Error ? err.message : String(err)}`, {
			source: 'system',
		});
		return null;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getRecord(value: unknown, key: string): Record<string, unknown> | undefined {
	if (!isRecord(value)) {
		return undefined;
	}
	const child = value[key];
	return isRecord(child) ? child : undefined;
}

function readString(value: unknown, key: string): string | undefined {
	if (!isRecord(value)) {
		return undefined;
	}
	const raw = value[key];
	return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined;
}

function isReasoningEffortAllowed(provider: LlmProvider, effort: string, configPath: string): boolean {
	if (provider === 'openai' && OPENAI_REASONING_EFFORTS.has(effort)) {
		return true;
	}
	if (provider === 'azure' && AZURE_REASONING_EFFORTS.has(effort)) {
		return true;
	}
	if (provider === 'openai' || provider === 'azure') {
		logger.warn(`Ignoring unsupported reasoning_effort "${effort}" for ${provider} in ${configPath}.`, {
			source: 'system',
		});
	}
	return false;
}

function parseGithubRepoFullName(url: string): string | null {
	const match = url.match(/github\.com[:/]([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[#?].*)?$/i);
	if (!match) {
		return null;
	}
	return `${match[1]}/${match[2].replace(/\.git$/i, '')}`;
}
