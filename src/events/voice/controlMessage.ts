import {
	ActionRowBuilder,
	EmbedBuilder,
	Guild,
	GuildMember,
	PermissionFlagsBits,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	VoiceChannel,
} from 'discord.js';
import { type Translator } from '../../core/I18N.js';
import { TempVoice } from '../../models/TempVoice.js';
import { VoiceACL } from '../../models/VoiceACL.js';

/** The rendered parts of a channel control message, ready to be sent or edited into place. */
export interface ChannelControlMessage {
	menuText: string;
	menuEmbed: EmbedBuilder;
	menuRow: ActionRowBuilder<StringSelectMenuBuilder>;
}

/**
 * Builds the channel control message content: a status embed and a select menu for channel options. Shows whitelist or blacklist fields based on channel visibility, and reflects current vs. saved settings.
 * @param t - Translation function for the guild's locale.
 * @param owner - The GuildMember who owns this temp channel.
 * @param guild - The guild the channel belongs to.
 * @param firstVoiceChannel - `true` if this is the owner's first-ever temp channel (shows a welcome message).
 * @param tempVoice - The saved TempVoice settings for this owner.
 * @param voiceACL - The list of ACL entries (whitelist/blacklist) for this owner's channel.
 * @param channel - The live VoiceChannel instance, used to read current permission overrides.
 * @returns An object with `menuText`, `menuEmbed`, and `menuRow`.
 */
export function createChannelControlMessage(
	t: Translator,
	owner: GuildMember,
	guild: Guild,
	firstVoiceChannel: boolean,
	tempVoice: TempVoice,
	voiceACL: VoiceACL[],
	channel: VoiceChannel,
): ChannelControlMessage {
	const menuText = firstVoiceChannel ? t('temp_voice.control_message.first_channel', { user: owner }) : '';

	const everyonePermissions = channel.permissionsFor(guild.roles.everyone);
	const liveSoundboard = everyonePermissions.has(PermissionFlagsBits.UseSoundboard);
	const liveStreams = everyonePermissions.has(PermissionFlagsBits.Stream);
	const liveActivities = everyonePermissions.has(PermissionFlagsBits.UseEmbeddedActivities);
	const livePrivate =
		!everyonePermissions.has(PermissionFlagsBits.ViewChannel) &&
		!everyonePermissions.has(PermissionFlagsBits.Connect);

	const menuEmbed = new EmbedBuilder()
		.setTitle(t('temp_voice.control_message.embed.title'))
		.setDescription(t('temp_voice.control_message.embed.description'))
		.setColor('#46d8ef')
		.addFields(
			{
				name: t('temp_voice.control_message.embed.fields.soundboards'),
				value: describeSetting(t, tempVoice.soundBoardEnabled, liveSoundboard, 'enabled', 'disabled'),
				inline: true,
			},
			{
				name: t('temp_voice.control_message.embed.fields.streams'),
				value: describeSetting(t, tempVoice.streamsEnabled, liveStreams, 'enabled', 'disabled'),
				inline: true,
			},
			{
				name: t('temp_voice.control_message.embed.fields.activities'),
				value: describeSetting(t, tempVoice.activitiesEnabled, liveActivities, 'enabled', 'disabled'),
				inline: true,
			},
			{
				name: t('temp_voice.control_message.embed.fields.availability'),
				value: describeSetting(t, tempVoice.privateChannel, livePrivate, 'private', 'public'),
				inline: true,
			},
			{
				name: t('temp_voice.control_message.embed.fields.messages_kept'),
				value: tempVoice.messagesToKeep
					? '```' + tempVoice.messagesToKeep + '```'
					: t('temp_voice.control_message.none'),
				inline: true,
			},
		)
		.setFooter({
			text: t('temp_voice.control_message.embed.footer', { user: owner.displayName }),
			iconURL: owner.displayAvatarURL(),
		});

	const menuSelect = new StringSelectMenuBuilder()
		.setCustomId('vc_controls')
		.setPlaceholder(t('misc.generic_selection'))
		.setMinValues(0)
		.setMaxValues(1)
		.addOptions(
			buildOption(t, 'name', 'name_change', '✒️'),
			buildOption(t, 'soundboards', 'soundboard_toggle', '📣'),
			buildOption(t, 'streams', 'stream_toggle', '🎥'),
			buildOption(t, 'activities', 'activities_toggle', '🎮'),
			buildOption(t, 'availability', 'private_channel', '👥'),
			buildOption(t, 'messages_kept', 'messages_deletion', '💬'),
		);

	// A private channel is managed by naming who may enter; a public one, by naming who may not.
	const aclField = livePrivate ? 'whitelist' : 'blacklist';
	const listedMembers = voiceACL
		.filter((entry) => entry.hasAccess == livePrivate)
		.map((entry) => `<@${entry.memberId}>`);

	if (listedMembers.length > 0) {
		menuEmbed.addFields({
			name: t(`temp_voice.control_message.embed.fields.${aclField}`),
			value: listedMembers.join(' | '),
			inline: false,
		});
	}

	menuSelect.addOptions(buildOption(t, aclField, aclField, livePrivate ? '✅' : '🚫'));

	const menuRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menuSelect);

	return { menuText, menuEmbed, menuRow };
}

/**
 * Renders the status of a channel setting, marking it as temporary when the live channel state differs from what the owner has saved as their default.
 * @param t - Translation function for the guild's locale.
 * @param savedState - The owner's saved default for this setting.
 * @param liveState - The state the channel is actually in right now.
 * @param onLabel - The locale key suffix used when the setting is on (e.g. `enabled`).
 * @param offLabel - The locale key suffix used when the setting is off (e.g. `disabled`).
 * @returns The translated status string.
 */
function describeSetting(
	t: Translator,
	savedState: boolean,
	liveState: boolean,
	onLabel: string,
	offLabel: string,
): string {
	const label = liveState ? onLabel : offLabel;
	const suffix = savedState == liveState ? '' : '_temp';

	return t(`temp_voice.control_message.${label}${suffix}`);
}

/**
 * Builds one entry of the channel controls select menu from its locale key.
 * @param t - Translation function for the guild's locale.
 * @param localeKey - The key under `temp_voice.control_message.select_menu` holding the label and description.
 * @param value - The value reported back when the option is selected.
 * @param emoji - The emoji shown next to the option.
 * @returns The configured select menu option.
 */
function buildOption(t: Translator, localeKey: string, value: string, emoji: string): StringSelectMenuOptionBuilder {
	return new StringSelectMenuOptionBuilder()
		.setLabel(t(`temp_voice.control_message.select_menu.${localeKey}.label`))
		.setDescription(t(`temp_voice.control_message.select_menu.${localeKey}.description`))
		.setValue(value)
		.setEmoji(emoji);
}
