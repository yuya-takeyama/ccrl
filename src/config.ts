import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const DirectoryEntrySchema = z.object({
	label: z.string(),
	path: z.string(),
});

const ConfigSchema = z.object({
	directories: z.array(DirectoryEntrySchema),
});

export type DirectoryEntry = z.infer<typeof DirectoryEntrySchema>;
export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
	const configPath = resolve(process.cwd(), "ccrl.config.json");
	if (existsSync(configPath)) {
		const raw = readFileSync(configPath, "utf-8");
		return ConfigSchema.parse(JSON.parse(raw));
	}

	const dirsEnv = process.env.CCRL_DIRS;
	if (dirsEnv) {
		return {
			directories: z.array(DirectoryEntrySchema).parse(JSON.parse(dirsEnv)),
		};
	}

	return { directories: [] };
}
