import { describe, expect, it } from "vitest";
import {
	extractRemoteControlUrl,
	generateBranchName,
	isValidWorktreePath,
} from "./launcher.js";

describe("generateBranchName", () => {
	it("produces claude-session-YYYY-MM-DDTHH-MM-SS format", () => {
		const date = new Date("2026-02-28T05:36:37.000Z");
		const name = generateBranchName(date);
		expect(name).toMatch(
			/^claude-session-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/,
		);
	});

	it("uses the provided date", () => {
		const date = new Date("2026-01-15T12:30:45.000Z");
		const name = generateBranchName(date);
		expect(name).toBe("claude-session-2026-01-15T12-30-45");
	});

	it("contains no colons or dots", () => {
		const name = generateBranchName(new Date("2026-02-28T05:36:37.123Z"));
		expect(name).not.toContain(":");
		expect(name).not.toContain(".");
	});

	it("starts with claude-session- prefix", () => {
		const name = generateBranchName(new Date());
		expect(name.startsWith("claude-session-")).toBe(true);
	});
});

describe("extractRemoteControlUrl", () => {
	it("extracts URL from text containing it", () => {
		const text = "Connect at https://claude.ai/remote-control/abc123 to start";
		expect(extractRemoteControlUrl(text)).toBe(
			"https://claude.ai/remote-control/abc123",
		);
	});

	it("returns undefined when no URL is present", () => {
		expect(extractRemoteControlUrl("No URL here")).toBeUndefined();
	});

	it("extracts URL at the start of text", () => {
		const text = "https://claude.ai/session/xyz";
		expect(extractRemoteControlUrl(text)).toBe("https://claude.ai/session/xyz");
	});

	it("extracts URL at the end of text", () => {
		const text = "Your session: https://claude.ai/remote/abc";
		expect(extractRemoteControlUrl(text)).toBe("https://claude.ai/remote/abc");
	});

	it("stops URL extraction at whitespace", () => {
		const text = "https://claude.ai/session/abc next line content";
		expect(extractRemoteControlUrl(text)).toBe("https://claude.ai/session/abc");
	});

	it("does not match non-claude.ai URLs", () => {
		const text = "Visit https://example.com for more info";
		expect(extractRemoteControlUrl(text)).toBeUndefined();
	});
});

describe("isValidWorktreePath", () => {
	const directories = [
		{ label: "my-app", path: "/home/user/my-app" },
		{ label: "other", path: "/home/user/other" },
	];

	it("returns true for valid repo and worktree path", () => {
		expect(
			isValidWorktreePath(
				directories,
				"/home/user/my-app",
				"/home/user/my-app/.cc-slack-worktrees/claude-session-2026-01-01T00-00-00",
			),
		).toBe(true);
	});

	it("returns false when repo is not in configured directories", () => {
		expect(
			isValidWorktreePath(
				directories,
				"/home/user/unknown-repo",
				"/home/user/unknown-repo/.cc-slack-worktrees/claude-session-2026-01-01T00-00-00",
			),
		).toBe(false);
	});

	it("returns false when worktree path is not under .cc-slack-worktrees/", () => {
		expect(
			isValidWorktreePath(
				directories,
				"/home/user/my-app",
				"/home/user/my-app/some-other-dir/session",
			),
		).toBe(false);
	});

	it("returns false for path traversal attacks using ..", () => {
		expect(
			isValidWorktreePath(
				directories,
				"/home/user/my-app",
				"/home/user/my-app/.cc-slack-worktrees/../../etc/passwd",
			),
		).toBe(false);
	});

	it("returns false when directories list is empty", () => {
		expect(
			isValidWorktreePath(
				[],
				"/home/user/my-app",
				"/home/user/my-app/.cc-slack-worktrees/session",
			),
		).toBe(false);
	});
});
