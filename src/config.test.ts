import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConfigHolder, loadConfig } from "./config.js";

vi.mock("node:fs");

import { existsSync, readFileSync, watch } from "node:fs";

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWatch = vi.mocked(watch);

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

describe("createConfigHolder", () => {
	const initialConfig = {
		directories: [{ label: "my-app", path: "/home/user/my-app" }],
	};
	const updatedConfig = {
		directories: [
			{ label: "my-app", path: "/home/user/my-app" },
			{ label: "other", path: "/home/user/other" },
		],
	};

	beforeEach(() => {
		vi.useFakeTimers();
		vi.resetAllMocks();
		delete process.env.CCRL_DIRS;
	});

	afterEach(() => {
		vi.useRealTimers();
		delete process.env.CCRL_DIRS;
	});

	it("returns initial config on creation", () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue(JSON.stringify(initialConfig));
		const mockWatcher = { close: vi.fn() };
		mockWatch.mockReturnValue(
			mockWatcher as unknown as ReturnType<typeof watch>,
		);

		const holder = createConfigHolder();
		expect(holder.current).toEqual(initialConfig);
		holder.close();
	});

	it("reloads config when file changes", async () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue(JSON.stringify(initialConfig));

		let capturedCallback: (() => void) | undefined;
		const mockWatcher = { close: vi.fn() };
		mockWatch.mockImplementation((_path, callback) => {
			capturedCallback = callback as () => void;
			return mockWatcher as unknown as ReturnType<typeof watch>;
		});

		const holder = createConfigHolder();
		expect(holder.current).toEqual(initialConfig);

		mockReadFileSync.mockReturnValue(JSON.stringify(updatedConfig));
		capturedCallback?.();
		await vi.advanceTimersByTimeAsync(200);

		expect(holder.current).toEqual(updatedConfig);
		holder.close();
	});

	it("keeps current config when reload produces invalid JSON", async () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue(JSON.stringify(initialConfig));

		let capturedCallback: (() => void) | undefined;
		const mockWatcher = { close: vi.fn() };
		mockWatch.mockImplementation((_path, callback) => {
			capturedCallback = callback as () => void;
			return mockWatcher as unknown as ReturnType<typeof watch>;
		});

		const holder = createConfigHolder();
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		mockReadFileSync.mockReturnValue("{ bad json");
		capturedCallback?.();
		await vi.advanceTimersByTimeAsync(200);

		expect(holder.current).toEqual(initialConfig);
		expect(errorSpy).toHaveBeenCalled();
		holder.close();
	});

	it("keeps current config when reload produces invalid schema", async () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue(JSON.stringify(initialConfig));

		let capturedCallback: (() => void) | undefined;
		const mockWatcher = { close: vi.fn() };
		mockWatch.mockImplementation((_path, callback) => {
			capturedCallback = callback as () => void;
			return mockWatcher as unknown as ReturnType<typeof watch>;
		});

		const holder = createConfigHolder();
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		mockReadFileSync.mockReturnValue(
			JSON.stringify({ directories: "not-an-array" }),
		);
		capturedCallback?.();
		await vi.advanceTimersByTimeAsync(200);

		expect(holder.current).toEqual(initialConfig);
		expect(errorSpy).toHaveBeenCalled();
		holder.close();
	});

	it("does not set up a watcher when config file does not exist", () => {
		mockExistsSync.mockReturnValue(false);

		const holder = createConfigHolder();

		expect(mockWatch).not.toHaveBeenCalled();
		expect(holder.current).toEqual({ directories: [] });
		holder.close();
	});

	it("close() cancels pending debounce and closes watcher", async () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue(JSON.stringify(initialConfig));

		let capturedCallback: (() => void) | undefined;
		const mockWatcher = { close: vi.fn() };
		mockWatch.mockImplementation((_path, callback) => {
			capturedCallback = callback as () => void;
			return mockWatcher as unknown as ReturnType<typeof watch>;
		});

		const holder = createConfigHolder();
		const initialReadCount = mockReadFileSync.mock.calls.length;

		capturedCallback?.();
		holder.close();
		await vi.advanceTimersByTimeAsync(200);

		expect(mockReadFileSync.mock.calls.length).toBe(initialReadCount);
		expect(mockWatcher.close).toHaveBeenCalled();
	});

	it("debounce collapses multiple rapid events into a single reload", async () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue(JSON.stringify(initialConfig));

		let capturedCallback: (() => void) | undefined;
		const mockWatcher = { close: vi.fn() };
		mockWatch.mockImplementation((_path, callback) => {
			capturedCallback = callback as () => void;
			return mockWatcher as unknown as ReturnType<typeof watch>;
		});

		const holder = createConfigHolder();
		const initialReadCount = mockReadFileSync.mock.calls.length;

		mockReadFileSync.mockReturnValue(JSON.stringify(updatedConfig));
		for (let i = 0; i < 5; i++) capturedCallback?.();
		await vi.advanceTimersByTimeAsync(200);

		expect(mockReadFileSync.mock.calls.length).toBe(initialReadCount + 1);
		expect(holder.current).toEqual(updatedConfig);
		holder.close();
	});
});
