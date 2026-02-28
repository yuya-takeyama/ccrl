import { existsSync, readFileSync, watch } from "node:fs";
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

export interface ConfigHolder {
	current: Config;
	close: () => void;
}

export function createConfigHolder(): ConfigHolder {
	const configPath = resolve(process.cwd(), "ccrl.config.json");

	const holder: ConfigHolder = {
		current: loadConfig(),
		close: () => {},
	};

	if (!existsSync(configPath)) {
		return holder;
	}

	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	let watcher: ReturnType<typeof watch>;
	try {
		watcher = watch(configPath, () => {
			if (debounceTimer !== undefined) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				debounceTimer = undefined;
				try {
					const raw = readFileSync(configPath, "utf-8");
					const newConfig = ConfigSchema.parse(JSON.parse(raw));
					holder.current = newConfig;
					console.log(
						`[ccrl] Config reloaded: ${newConfig.directories.length} directories`,
					);
				} catch (err) {
					console.error(
						"[ccrl] Config reload failed, keeping previous config:",
						err instanceof Error ? err.message : String(err),
					);
				}
			}, 200);
		});
	} catch (err) {
		console.warn(
			"[ccrl] Could not watch config file, live reload disabled:",
			err instanceof Error ? err.message : String(err),
		);
		return holder;
	}

	holder.close = () => {
		if (debounceTimer !== undefined) clearTimeout(debounceTimer);
		watcher.close();
	};

	return holder;
}

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
