import type { View } from "@slack/types";
import type { DirectoryEntry } from "./config.js";

export interface ModalMetadata {
	channelId: string;
}

export function buildLaunchModal(
	directories: DirectoryEntry[],
	channelId: string,
): View {
	return {
		type: "modal",
		callback_id: "ccrl_launch",
		private_metadata: JSON.stringify({ channelId } satisfies ModalMetadata),
		title: { type: "plain_text", text: "Launch Claude Code" },
		submit: { type: "plain_text", text: "Launch" },
		close: { type: "plain_text", text: "Cancel" },
		blocks: [
			{
				type: "input",
				block_id: "directory",
				label: { type: "plain_text", text: "Directory" },
				element: {
					type: "static_select",
					action_id: "directory_select",
					placeholder: { type: "plain_text", text: "Select a directory" },
					options: directories.map((dir) => ({
						text: { type: "plain_text", text: dir.label },
						value: dir.path,
					})),
				},
			},
			{
				type: "input",
				block_id: "worktree",
				optional: true,
				label: { type: "plain_text", text: "Options" },
				element: {
					type: "checkboxes",
					action_id: "worktree_checkbox",
					options: [
						{
							text: { type: "plain_text", text: "Create worktree" },
							description: {
								type: "plain_text",
								text: "New branch in .cc-slack-worktrees/",
							},
							value: "create_worktree",
						},
					],
				},
			},
		],
	};
}
