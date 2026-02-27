import { App } from "@slack/bolt";
import { loadConfig } from "./config.js";
import { createWorktree, launchRemoteControl } from "./launcher.js";
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

	app.view("ccrl_launch", async ({ ack, view, client }) => {
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
