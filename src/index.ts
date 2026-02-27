import { App } from "@slack/bolt";
import { loadConfig } from "./config.js";
import {
	createWorktree,
	launchRemoteControl,
	removeWorktree,
} from "./launcher.js";
import { buildLaunchModal, type ModalMetadata } from "./modal.js";

async function main() {
	const config = loadConfig();

	const { SLACK_BOT_TOKEN, SLACK_APP_TOKEN } = process.env;
	if (!SLACK_BOT_TOKEN) throw new Error("SLACK_BOT_TOKEN is required");
	if (!SLACK_APP_TOKEN) throw new Error("SLACK_APP_TOKEN is required");

	const app = new App({
		token: SLACK_BOT_TOKEN,
		socketMode: true,
		appToken: SLACK_APP_TOKEN,
	});

	app.command("/ccrl", async ({ command, ack, client }) => {
		await ack();

		if (config.directories.length === 0) {
			await client.chat.postMessage({
				channel: command.channel_id,
				text: "No directories configured. Create `ccrl.config.json` first.",
			});
			return;
		}

		await client.views.open({
			trigger_id: command.trigger_id,
			view: buildLaunchModal(config.directories, command.channel_id),
		});
	});

	app.view("ccrl_launch", async ({ ack, view, body, client }) => {
		await ack();

		const { channelId } = JSON.parse(view.private_metadata) as ModalMetadata;
		const values = view.state.values;

		const selectedPath =
			values.directory?.directory_select?.selected_option?.value;
		const createWorktreeChecked = (
			values.worktree?.worktree_checkbox?.selected_options ?? []
		).some((opt) => opt.value === "create_worktree");

		if (!selectedPath) return;

		const dirEntry = config.directories.find((d) => d.path === selectedPath);
		const dirLabel = dirEntry?.label ?? selectedPath;

		const { ts: threadTs } = await client.chat.postMessage({
			channel: channelId,
			text: `🚀 Launching Claude Code in *${dirLabel}*${createWorktreeChecked ? " (new worktree)" : ""}...`,
		});

		void (async () => {
			try {
				let targetDir = selectedPath;

				if (createWorktreeChecked) {
					targetDir = await createWorktree(selectedPath);
					await client.chat.postMessage({
						channel: channelId,
						thread_ts: threadTs,
						text: `🌿 Worktree created: \`${targetDir}\``,
						blocks: [
							{
								type: "section",
								text: {
									type: "mrkdwn",
									text: `🌿 Worktree created: \`${targetDir}\``,
								},
							},
							{
								type: "actions",
								elements: [
									{
										type: "button",
										text: { type: "plain_text", text: "Delete worktree" },
										style: "danger",
										action_id: "delete_worktree",
										value: JSON.stringify({
											repoPath: selectedPath,
											worktreePath: targetDir,
											userId: body.user.id,
										}),
										confirm: {
											title: {
												type: "plain_text",
												text: "Delete worktree?",
											},
											text: {
												type: "plain_text",
												text: `Remove ${targetDir}?`,
											},
											confirm: { type: "plain_text", text: "Delete" },
											deny: { type: "plain_text", text: "Cancel" },
										},
									},
								],
							},
						],
					});
				}

				const url = await launchRemoteControl(targetDir);

				await client.chat.postMessage({
					channel: channelId,
					thread_ts: threadTs,
					text: `✅ Claude Code is ready!\n${url}`,
				});
			} catch (err) {
				await client.chat.postMessage({
					channel: channelId,
					thread_ts: threadTs,
					text: `❌ Launch failed: ${err instanceof Error ? err.message : String(err)}`,
				});
			}
		})();
	});

	app.action("delete_worktree", async ({ ack, body, client, action }) => {
		await ack();

		const channel = (body as { channel?: { id: string } }).channel?.id;
		const ts = (body as { message?: { ts: string } }).message?.ts;
		const threadTs = (body as { message?: { thread_ts?: string } }).message
			?.thread_ts;

		if (!channel || !ts) return;

		let repoPath: string;
		let worktreePath: string;
		let userId: string;
		try {
			const parsed = JSON.parse((action as { value: string }).value) as {
				repoPath: string;
				worktreePath: string;
				userId: string;
			};
			repoPath = parsed.repoPath;
			worktreePath = parsed.worktreePath;
			userId = parsed.userId;
		} catch {
			await client.chat.update({
				channel,
				ts,
				text: "❌ Failed to delete worktree: invalid action payload",
				blocks: [
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: "❌ Failed to delete worktree: invalid action payload",
						},
					},
				],
			});
			return;
		}

		if (body.user.id !== userId) {
			await client.chat.postEphemeral({
				channel,
				user: body.user.id,
				text: "You are not authorized to delete this worktree.",
			});
			return;
		}

		// Validate that repoPath is one of the configured directories and
		// worktreePath is inside its .cc-slack-worktrees/ subdirectory
		const isValidRepo = config.directories.some((d) => d.path === repoPath);
		const isValidWorktree = worktreePath.startsWith(
			`${repoPath}/.cc-slack-worktrees/`,
		);
		if (!isValidRepo || !isValidWorktree) {
			await client.chat.postEphemeral({
				channel,
				user: body.user.id,
				text: "Invalid worktree path.",
			});
			return;
		}

		try {
			await removeWorktree(repoPath, worktreePath);
			await client.chat.update({
				channel,
				ts,
				text: `✅ Worktree deleted: \`${worktreePath}\``,
				blocks: [
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: `✅ Worktree deleted: \`${worktreePath}\``,
						},
					},
				],
			});
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			await client.chat.update({
				channel,
				ts,
				text: `❌ Failed to delete worktree: \`${worktreePath}\``,
				blocks: [
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: `❌ Failed to delete worktree: \`${worktreePath}\``,
						},
					},
				],
			});
			if (threadTs) {
				await client.chat.postMessage({
					channel,
					thread_ts: threadTs,
					text: `❌ Failed to delete worktree:\n\`\`\`${errorMessage}\`\`\``,
				});
			}
		}
	});

	await app.start();
	console.log("✅ CCRL running");
}

main().catch((err) => {
	console.error(
		"❌ Failed to start CCRL:",
		err instanceof Error ? err.message : err,
	);
	process.exit(1);
});
