import { App } from "@slack/bolt";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { buildHomeView } from "./home.js";
import {
	createWorktree,
	isValidWorktreePath,
	launchRemoteControl,
	removeWorktree,
} from "./launcher.js";
import { buildLaunchModal, ModalMetadataSchema } from "./modal.js";
import {
	buildDeleteWorktreeBlocks,
	formatErrorMessage,
	mrkdwnSection,
} from "./slack-blocks.js";

const DeleteWorktreePayloadSchema = z.object({
	repoPath: z.string(),
	worktreePath: z.string(),
	userId: z.string(),
});

const BlockActionBodySchema = z.object({
	channel: z.object({ id: z.string() }).optional(),
	message: z
		.object({
			ts: z.string(),
			thread_ts: z.string().optional(),
		})
		.optional(),
});

const ButtonActionSchema = z.object({
	value: z.string(),
});

const TriggerIdBodySchema = z.object({
	trigger_id: z.string(),
});

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

	app.event("app_home_opened", async ({ event, client }) => {
		await client.views.publish({
			user_id: event.user,
			view: buildHomeView(config.directories),
		});
	});

	app.action("launch_ccrl", async ({ ack, body, client }) => {
		await ack();
		const { trigger_id } = TriggerIdBodySchema.parse(body);

		if (config.directories.length === 0) {
			await client.views.open({
				trigger_id,
				view: {
					type: "modal",
					title: { type: "plain_text", text: "No directories configured" },
					close: { type: "plain_text", text: "Close" },
					blocks: [
						mrkdwnSection(
							"No directories configured. Create `ccrl.config.json` first.",
						),
					],
				},
			});
			return;
		}

		await client.views.open({
			trigger_id,
			view: buildLaunchModal(config.directories),
		});
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

		const { channelId } = ModalMetadataSchema.parse(
			JSON.parse(view.private_metadata),
		);

		let responseChannelId: string;
		if (channelId) {
			responseChannelId = channelId;
		} else {
			const dm = await client.conversations.open({ users: body.user.id });
			if (!dm.ok || !dm.channel?.id) {
				console.error(
					"Failed to open DM channel for user",
					body.user.id,
					"Slack API error:",
					dm.error ?? "unknown error",
				);
				return;
			}
			responseChannelId = dm.channel.id;
		}

		const values = view.state.values;

		const selectedPath =
			values.directory?.directory_select?.selected_option?.value;
		const rawSessionName = values.session_name?.session_name_input?.value;
		const sessionName = rawSessionName
			? rawSessionName.trim() || undefined
			: undefined;
		const createWorktreeChecked = (
			values.worktree?.worktree_checkbox?.selected_options ?? []
		).some((opt) => opt.value === "create_worktree");

		if (!selectedPath) return;

		const dirEntry = config.directories.find((d) => d.path === selectedPath);
		const dirLabel = dirEntry?.label ?? selectedPath;

		// Slack mrkdwn uses HTML entity escaping for &, <, > to prevent link/mention parsing
		const escapedSessionName = sessionName
			?.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");

		const launchingText = [
			`🚀 Launching Claude Code in *${dirLabel}*${createWorktreeChecked ? " (new worktree)" : ""}...`,
			...(escapedSessionName ? [`📝 ${escapedSessionName}`] : []),
		].join("\n");

		const { ts: threadTs } = await client.chat.postMessage({
			channel: responseChannelId,
			text: launchingText,
		});

		void (async () => {
			try {
				let targetDir = selectedPath;

				if (createWorktreeChecked) {
					targetDir = await createWorktree(selectedPath);
					await client.chat.postMessage({
						channel: responseChannelId,
						thread_ts: threadTs,
						text: `🌿 Worktree created: \`${targetDir}\``,
						blocks: buildDeleteWorktreeBlocks(
							selectedPath,
							targetDir,
							body.user.id,
						),
					});
				}

				const url = await launchRemoteControl(targetDir);

				await client.chat.postMessage({
					channel: responseChannelId,
					thread_ts: threadTs,
					text: `✅ Claude Code is ready!\n${url}`,
				});
			} catch (err) {
				await client.chat.postMessage({
					channel: responseChannelId,
					thread_ts: threadTs,
					text: `❌ Launch failed: ${formatErrorMessage(err)}`,
				});
			}
		})();
	});

	app.action("delete_worktree", async ({ ack, body, client, action }) => {
		await ack();

		const { channel: channelObj, message } = BlockActionBodySchema.parse(body);
		const channel = channelObj?.id;
		const ts = message?.ts;
		const threadTs = message?.thread_ts;

		if (!channel || !ts) return;

		let repoPath: string;
		let worktreePath: string;
		let userId: string;
		try {
			const { value } = ButtonActionSchema.parse(action);
			const payload = DeleteWorktreePayloadSchema.parse(JSON.parse(value));
			repoPath = payload.repoPath;
			worktreePath = payload.worktreePath;
			userId = payload.userId;
		} catch {
			const msg = "❌ Failed to delete worktree: invalid action payload";
			await client.chat.update({
				channel,
				ts,
				text: msg,
				blocks: [mrkdwnSection(msg)],
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

		if (!isValidWorktreePath(config.directories, repoPath, worktreePath)) {
			await client.chat.postEphemeral({
				channel,
				user: body.user.id,
				text: "Invalid worktree path.",
			});
			return;
		}

		try {
			await removeWorktree(repoPath, worktreePath);
			const msg = `✅ Worktree deleted: \`${worktreePath}\``;
			await client.chat.update({
				channel,
				ts,
				text: msg,
				blocks: [mrkdwnSection(msg)],
			});
		} catch (err) {
			const msg = `❌ Failed to delete worktree: \`${worktreePath}\``;
			await client.chat.update({
				channel,
				ts,
				text: msg,
				blocks: [mrkdwnSection(msg)],
			});
			if (threadTs) {
				await client.chat.postMessage({
					channel,
					thread_ts: threadTs,
					text: `❌ Failed to delete worktree:\n\`\`\`${formatErrorMessage(err)}\`\`\``,
				});
			}
		}
	});

	await app.start();
	console.log("✅ CCRL running");
}

main().catch((err) => {
	console.error("❌ Failed to start CCRL:", formatErrorMessage(err));
	process.exit(1);
});
