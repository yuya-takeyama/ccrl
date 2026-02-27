import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "./config.js";

vi.mock("node:fs");

import { existsSync, readFileSync } from "node:fs";

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

describe("loadConfig", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		delete process.env.CCRL_DIRS;
	});

	afterEach(() => {
		delete process.env.CCRL_DIRS;
	});

	it("reads ccrl.config.json when it exists", () => {
		const config = {
			directories: [{ label: "my-app", path: "/home/user/my-app" }],
		};
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue(JSON.stringify(config));

		expect(loadConfig()).toEqual(config);
	});

	it("falls back to CCRL_DIRS env var when config file does not exist", () => {
		const directories = [{ label: "my-app", path: "/home/user/my-app" }];
		mockExistsSync.mockReturnValue(false);
		process.env.CCRL_DIRS = JSON.stringify(directories);

		expect(loadConfig()).toEqual({ directories });
	});

	it("returns empty config when neither config file nor CCRL_DIRS is set", () => {
		mockExistsSync.mockReturnValue(false);

		expect(loadConfig()).toEqual({ directories: [] });
	});
});
