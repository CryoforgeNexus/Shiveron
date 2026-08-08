import { ChatInputCommandInteraction, GuildMember, PermissionFlagsBits } from 'discord.js';

export enum ModerationAction {
	BAN = 'ban',
	KICK = 'kick',
	TIMEOUT = 'timeout',
	WARN = 'warn',
}

/**
 * Validates that a moderation action is permissible, checking the target's existence, that the author is not targeting themselves, that the target is not an admin, and that the author's highest role is above the target's. Replies to the interaction with an appropriate error message on failure.
 * @param interaction - The slash command interaction, used to send error replies.
 * @param target - The GuildMember being targeted by the action, or `null` if not found.
 * @param author - The GuildMember who issued the command.
 * @param action - The moderation action being performed (used in error message text).
 * @returns `true` if the action is permitted, `false` otherwise.
 */
export async function validateAuthor(
	interaction: ChatInputCommandInteraction,
	target: GuildMember | null,
	author: GuildMember,
	action: ModerationAction,
): Promise<boolean> {
	if (!validateTarget(interaction, target)) {
		return false;
	} else if (target!.id == author.id) {
		interaction.editReply({ content: `You cannot ${action} yourself.` });
		return false;
	} else if (target!.permissions.has(PermissionFlagsBits.Administrator)) {
		interaction.editReply({ content: `I cannot ${action} this member.` });
		return false;
	} else if (author.roles.highest.comparePositionTo(target!.roles.highest)) {
		interaction.editReply({ content: `You cannot ${action} this member, he has a higher role than you.` });
		return false;
	}
	return true;
}

/**
 * Validates that the target member exists (i.e., was found in the guild). Replies to the interaction with an error message if the target is `null`.
 * @param interaction - The slash command interaction, used to send the error reply.
 * @param target - The GuildMember to validate, or `null` if not found.
 * @returns `true` if the target exists, `false` otherwise.
 */
export async function validateTarget(
	interaction: ChatInputCommandInteraction,
	target: GuildMember | null,
): Promise<boolean> {
	if (!target) {
		interaction.editReply({ content: 'I cannot find the specified member.' });
		return false;
	}
	return true;
}
