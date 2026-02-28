import type { KnownBlock, SectionBlock } from "@slack/types";

export function mrkdwnSection(text: string): SectionBlock {
	return {
		type: "section",
		text: { type: "mrkdwn", text },
	};
}

export function formatErrorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

export function buildDeleteWorktreeBlocks(
	repoPath: string,
	worktreePath: string,
	userId: string,
): KnownBlock[] {
	return [
		mrkdwnSection(`🌿 Worktree created: \`${worktreePath}\``),
		{
			type: "actions",
			elements: [
				{
					type: "button",
					text: { type: "plain_text", text: "Delete worktree" },
					style: "danger",
					action_id: "delete_worktree",
					value: JSON.stringify({ repoPath, worktreePath, userId }),
					confirm: {
						title: { type: "plain_text", text: "Delete worktree?" },
						text: { type: "plain_text", text: `Remove ${worktreePath}?` },
						confirm: { type: "plain_text", text: "Delete" },
						deny: { type: "plain_text", text: "Cancel" },
					},
				},
			],
		},
	];
}
