import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface DirectoryEntry {
	label: string;
	path: string;
}

export interface Config {
	directories: DirectoryEntry[];
}

export function loadConfig(): Config {
	const configPath = resolve(process.cwd(), "ccrl.config.json");
	if (existsSync(configPath)) {
		const raw = readFileSync(configPath, "utf-8");
		return JSON.parse(raw) as Config;
	}

	const dirsEnv = process.env.CCRL_DIRS;
	if (dirsEnv) {
		return { directories: JSON.parse(dirsEnv) as DirectoryEntry[] };
	}

	return { directories: [] };
}
