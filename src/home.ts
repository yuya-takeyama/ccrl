import type { View } from "@slack/types";
import type { DirectoryEntry } from "./config.js";
import { mrkdwnSection } from "./slack-blocks.js";

export function buildHomeView(directories: DirectoryEntry[]): View {
	const header = {
		type: "header" as const,
		text: {
			type: "plain_text" as const,
			text: "CCRL - Claude Code Remote Launcher",
		},
	};

	if (directories.length === 0) {
		return {
			type: "home",
			blocks: [
				header,
				mrkdwnSection(
					"⚠️ No directories configured. Set the `CCRL_DIRS` env var or create `ccrl.config.json` first.",
				),
			],
		};
	}

	return {
		type: "home",
		blocks: [
			header,
			mrkdwnSection("Launch a Claude Code remote session from here."),
			{
				type: "actions",
				elements: [
					{
						type: "button",
						action_id: "launch_ccrl",
						text: {
							type: "plain_text",
							text: "🚀 Launch Claude Code",
						},
						style: "primary",
					},
				],
			},
		],
	};
}
