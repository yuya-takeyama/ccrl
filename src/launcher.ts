import { execFile, spawn } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import type { DirectoryEntry } from "./config.js";

const execFileAsync = promisify(execFile);

const LAUNCH_TIMEOUT_MS = 30_000;
// claude remote-control outputs the URL to connect to the session
const REMOTE_CONTROL_URL_RE = /https:\/\/claude\.ai[^\s]*/;

export function generateBranchName(now: Date = new Date()): string {
	const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
	return `claude-session-${timestamp}`;
}

export function extractRemoteControlUrl(text: string): string | undefined {
	const match = text.match(REMOTE_CONTROL_URL_RE);
	return match?.[0];
}

export function isValidWorktreePath(
	directories: DirectoryEntry[],
	repoPath: string,
	worktreePath: string,
): boolean {
	const isValidRepo = directories.some((d) => d.path === repoPath);
	// Resolve to normalize away any ".." path traversal attempts
	const resolvedWorktree = resolve(worktreePath);
	const expectedPrefix = `${repoPath}/.cc-slack-worktrees/`;
	return isValidRepo && resolvedWorktree.startsWith(expectedPrefix);
}

export async function removeWorktree(
	repoPath: string,
	worktreePath: string,
): Promise<void> {
	await execFileAsync("git", [
		"-C",
		repoPath,
		"worktree",
		"remove",
		"--force",
		"--",
		worktreePath,
	]);
	const branchName = worktreePath.split("/").at(-1);
	if (branchName) {
		try {
			await execFileAsync("git", [
				"-C",
				repoPath,
				"branch",
				"-D",
				"--",
				branchName,
			]);
		} catch (err: unknown) {
			// Best-effort: if the branch is already gone, don't treat this as a failure.
			const notFoundText = `branch '${branchName}' not found`;
			const message = err instanceof Error ? err.message : String(err);
			const stderr =
				err !== null && typeof err === "object" && "stderr" in err
					? String((err as { stderr: unknown }).stderr)
					: "";
			if (!message.includes(notFoundText) && !stderr.includes(notFoundText)) {
				throw err;
			}
		}
	}
}

export async function createWorktree(repoPath: string): Promise<string> {
	const branchName = generateBranchName();
	const worktreePath = `${repoPath}/.cc-slack-worktrees/${branchName}`;

	await execFileAsync("git", [
		"-C",
		repoPath,
		"worktree",
		"add",
		"-b",
		branchName,
		worktreePath,
	]);

	return worktreePath;
}

export function launchRemoteControl(directory: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn("claude", ["remote-control"], {
			cwd: directory,
			// stdin を無視、stdout をキャプチャ（URL は stdout に出力される）
			stdio: ["ignore", "pipe", "inherit"],
		});

		let found = false;

		const timeout = setTimeout(() => {
			if (!found) {
				reject(new Error("Timed out waiting for Remote Control URL"));
			}
		}, LAUNCH_TIMEOUT_MS);

		function onData(chunk: Buffer) {
			if (found) return;
			const url = extractRemoteControlUrl(chunk.toString("utf-8"));
			if (url) {
				found = true;
				clearTimeout(timeout);
				resolve(url);
			}
		}

		child.stdout.on("data", onData);

		child.on("error", (err) => {
			if (!found) {
				clearTimeout(timeout);
				reject(err);
			}
		});

		child.on("exit", (code) => {
			if (!found) {
				clearTimeout(timeout);
				reject(
					new Error(`claude exited with code ${code} before URL was found`),
				);
			}
		});
	});
}
