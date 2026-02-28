import { describe, expect, it } from "vitest";
import {
	buildDeleteWorktreeBlocks,
	formatErrorMessage,
	mrkdwnSection,
} from "./slack-blocks.js";

describe("mrkdwnSection", () => {
	it("returns a section block with mrkdwn text", () => {
		expect(mrkdwnSection("hello world")).toEqual({
			type: "section",
			text: { type: "mrkdwn", text: "hello world" },
		});
	});

	it("handles empty string", () => {
		expect(mrkdwnSection("")).toEqual({
			type: "section",
			text: { type: "mrkdwn", text: "" },
		});
	});

	it("preserves markdown formatting", () => {
		const result = mrkdwnSection("*bold* and `code`");
		expect(result.text?.text).toBe("*bold* and `code`");
	});
});

describe("formatErrorMessage", () => {
	it("returns message from Error instance", () => {
		expect(formatErrorMessage(new Error("something went wrong"))).toBe(
			"something went wrong",
		);
	});

	it("converts string to itself", () => {
		expect(formatErrorMessage("plain string error")).toBe("plain string error");
	});

	it("converts number to string", () => {
		expect(formatErrorMessage(42)).toBe("42");
	});

	it("converts null to string", () => {
		expect(formatErrorMessage(null)).toBe("null");
	});

	it("converts object to string", () => {
		expect(formatErrorMessage({ code: 500 })).toBe("[object Object]");
	});
});

describe("buildDeleteWorktreeBlocks", () => {
	const repoPath = "/home/user/my-app";
	const worktreePath =
		"/home/user/my-app/.cc-slack-worktrees/claude-session-2026-01-01T00-00-00";
	const userId = "U12345678";

	it("returns section block and actions block", () => {
		const blocks = buildDeleteWorktreeBlocks(repoPath, worktreePath, userId);
		expect(blocks).toHaveLength(2);
		expect(blocks[0].type).toBe("section");
		expect(blocks[1].type).toBe("actions");
	});

	it("includes worktree path in section text", () => {
		const blocks = buildDeleteWorktreeBlocks(repoPath, worktreePath, userId);
		const section = blocks[0] as { type: string; text: { text: string } };
		expect(section.text.text).toContain(worktreePath);
	});

	it("encodes repoPath, worktreePath, and userId as JSON in button value", () => {
		const blocks = buildDeleteWorktreeBlocks(repoPath, worktreePath, userId);
		const actionsBlock = blocks[1] as {
			type: string;
			elements: Array<{ value: string }>;
		};
		const payload = JSON.parse(actionsBlock.elements[0].value);
		expect(payload).toEqual({ repoPath, worktreePath, userId });
	});

	it("sets button action_id to delete_worktree", () => {
		const blocks = buildDeleteWorktreeBlocks(repoPath, worktreePath, userId);
		const actionsBlock = blocks[1] as {
			type: string;
			elements: Array<{ action_id: string }>;
		};
		expect(actionsBlock.elements[0].action_id).toBe("delete_worktree");
	});

	it("uses worktreePath in confirmation dialog text", () => {
		const blocks = buildDeleteWorktreeBlocks(repoPath, worktreePath, userId);
		const actionsBlock = blocks[1] as {
			type: string;
			elements: Array<{ confirm: { text: { text: string } } }>;
		};
		expect(actionsBlock.elements[0].confirm.text.text).toContain(worktreePath);
	});
});
