import type { View } from "@slack/types";
import type { DirectoryEntry } from "./config.js";

export function buildHomeView(directories: DirectoryEntry[]): View {
	if (directories.length === 0) {
		return {
			type: "home",
			blocks: [
				{
					type: "header",
					text: {
						type: "plain_text",
						text: "CCRL - Claude Code Remote Launcher",
					},
				},
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: "⚠️ No directories configured. Set the `CCRL_DIRS` env var or create `ccrl.config.json` first.",
					},
				},
			],
		};
	}

	return {
		type: "home",
		blocks: [
			{
				type: "header",
				text: {
					type: "plain_text",
					text: "CCRL - Claude Code Remote Launcher",
				},
			},
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: "Launch a Claude Code remote session from here.",
				},
			},
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
