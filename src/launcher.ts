import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const LAUNCH_TIMEOUT_MS = 30_000;
// claude remote-control outputs the URL to connect to the session
const REMOTE_CONTROL_URL_RE = /https:\/\/claude\.ai[^\s]*/;

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
		worktreePath,
	]);
	const branchName = worktreePath.split("/").at(-1);
	if (branchName) {
		await execFileAsync("git", ["-C", repoPath, "branch", "-D", branchName]);
	}

export async function createWorktree(repoPath: string): Promise<string> {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
	const branchName = `claude-session-${timestamp}`;
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
			const text = chunk.toString("utf-8");
			const match = text.match(REMOTE_CONTROL_URL_RE);
			if (match) {
				found = true;
				clearTimeout(timeout);
				resolve(match[0]);
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
