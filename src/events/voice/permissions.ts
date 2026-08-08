import { OverwriteType, PermissionFlagsBits } from 'discord.js';
import { TempVoice } from '../../models/TempVoice.js';
import { VoiceACL } from '../../models/VoiceACL.js';

/** A single permission override entry, in the shape discord.js accepts when creating or updating a channel. */
export interface VoicePermissionOverwrite {
	id: string;
	type: OverwriteType;
	allow: bigint[];
	deny: bigint[];
}

// Granted to @everyone in every temp channel, regardless of the owner's settings.
const BASE_EVERYONE_PERMISSIONS = [
	PermissionFlagsBits.Speak,
	PermissionFlagsBits.UseExternalSounds,
	PermissionFlagsBits.UseVAD,
	PermissionFlagsBits.SendMessages,
	PermissionFlagsBits.EmbedLinks,
	PermissionFlagsBits.AttachFiles,
	PermissionFlagsBits.AddReactions,
	PermissionFlagsBits.UseExternalEmojis,
	PermissionFlagsBits.UseExternalStickers,
	PermissionFlagsBits.ReadMessageHistory,
	PermissionFlagsBits.SendTTSMessages,
	PermissionFlagsBits.UseApplicationCommands,
	PermissionFlagsBits.SendVoiceMessages,
	PermissionFlagsBits.UseExternalApps,
];

/**
 * Builds the full permission overrides array for a temp voice channel based on the owner's saved settings and ACL. Grants the owner MoveMembers + full access, applies everyone permissions based on soundboard/stream/activities/private flags, and adds individual allow/deny entries for each ACL member.
 * @param ownerId - The Discord user ID of the channel owner.
 * @param everyoneId - The ID of the guild's @everyone role.
 * @param tempVoice - The saved TempVoice settings used to determine permission flags.
 * @param voiceACL - The list of ACL entries for individual member overrides.
 * @returns An array of permission override objects consumable by discord.js channel creation/update.
 */
export function buildUserVoicePermissions(
	ownerId: string,
	everyoneId: string,
	tempVoice: TempVoice,
	voiceACL: VoiceACL[],
): VoicePermissionOverwrite[] {
	const ownerOverwrite: VoicePermissionOverwrite = {
		id: ownerId,
		type: OverwriteType.Member,
		allow: [PermissionFlagsBits.MoveMembers, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
		deny: [],
	};

	const everyoneOverwrite: VoicePermissionOverwrite = {
		id: everyoneId,
		type: OverwriteType.Role,
		allow: [...BASE_EVERYONE_PERMISSIONS],
		deny: [],
	};

	// A private channel is one @everyone can neither see nor join.
	applyToggle(everyoneOverwrite, !tempVoice.privateChannel, [
		PermissionFlagsBits.Connect,
		PermissionFlagsBits.ViewChannel,
	]);
	applyToggle(everyoneOverwrite, tempVoice.soundBoardEnabled, [PermissionFlagsBits.UseSoundboard]);
	applyToggle(everyoneOverwrite, tempVoice.streamsEnabled, [PermissionFlagsBits.Stream]);
	applyToggle(everyoneOverwrite, tempVoice.activitiesEnabled, [PermissionFlagsBits.UseEmbeddedActivities]);

	const memberOverwrites: VoicePermissionOverwrite[] = voiceACL.map((entry) => {
		const access = [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel];

		return {
			id: entry.memberId,
			type: OverwriteType.Member,
			allow: entry.hasAccess ? access : [],
			deny: entry.hasAccess ? [] : access,
		};
	});

	return [ownerOverwrite, everyoneOverwrite, ...memberOverwrites];
}

/**
 * Pushes a set of permission flags onto the allow or deny list of an override, depending on a setting.
 * @param overwrite - The override to mutate.
 * @param enabled - `true` to allow the flags, `false` to deny them.
 * @param permissions - The permission flags to apply.
 */
function applyToggle(overwrite: VoicePermissionOverwrite, enabled: boolean, permissions: bigint[]): void {
	if (enabled) {
		overwrite.allow.push(...permissions);
	} else {
		overwrite.deny.push(...permissions);
	}
}
