import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Collection,
	ComponentType,
	GuildMember,
	Message,
	MessageFlags,
	PermissionFlagsBits,
	type PermissionOverwriteOptions,
	StringSelectMenuInteraction,
	UserSelectMenuBuilder,
	UserSelectMenuInteraction,
	VoiceChannel,
} from 'discord.js';
import { type Translator } from '../../core/I18N.js';
import { ShiveronClient } from '../../core/ShiveronClient.js';
import { type CreateTempVoiceData } from '../../services/VoiceService.js';
import { awaitAuthorizedComponentInteraction, awaitAuthorizedMessage } from '../../utils/discord/interactions.js';
import { createChannelControlMessage } from './controlMessage.js';
import { DISCORD_MAX_CHANNEL_NAME_LENGTH, DISCORD_SELECT_MENU_MAX_VALUES } from '../../utils/constants.js';

/** A channel setting backed by a single @everyone permission that the owner can flip on or off. */
interface PermissionToggle {
	permission: bigint;
	localeKey: string;
	buildOverwrite: (enabled: boolean) => PermissionOverwriteOptions;
	buildUpdate: (enabled: boolean) => Partial<CreateTempVoiceData>;
}

const PERMISSION_TOGGLES: Record<string, PermissionToggle> = {
	soundboard_toggle: {
		permission: PermissionFlagsBits.UseSoundboard,
		localeKey: 'soundboards',
		buildOverwrite: (enabled) => ({ UseSoundboard: enabled }),
		buildUpdate: (enabled) => ({ soundBoardEnabled: enabled }),
	},
	stream_toggle: {
		permission: PermissionFlagsBits.Stream,
		localeKey: 'streams',
		buildOverwrite: (enabled) => ({ Stream: enabled }),
		buildUpdate: (enabled) => ({ streamsEnabled: enabled }),
	},
	activities_toggle: {
		permission: PermissionFlagsBits.UseEmbeddedActivities,
		localeKey: 'activities',
		buildOverwrite: (enabled) => ({ UseEmbeddedActivities: enabled }),
		buildUpdate: (enabled) => ({ activitiesEnabled: enabled }),
	},
};

/**
 * Attaches a string select menu collector to the channel control message.
 * Dispatches each selection to the appropriate handler and refreshes the control message afterward.
 * @param client - The bot client instance.
 * @param t - Translation function for the guild's locale.
 * @param message - The channel control message to attach the collector to.
 * @param channelOwner - The GuildMember who owns this temp channel; only they may interact.
 * @param channel - The live VoiceChannel instance, passed to handlers that need it.
 */
export function attachControlCollector(
	client: ShiveronClient,
	t: Translator,
	message: Message,
	channelOwner: GuildMember,
	channel: VoiceChannel,
): void {
	const channelControlCollector = message.createMessageComponentCollector({
		componentType: ComponentType.StringSelect,
		filter: (i) => i.user.id == channelOwner.id,
	});

	channelControlCollector.on('ignore', async (interaction) => {
		interaction.reply({
			content: t('misc.interaction_forbidden', { user: interaction.user }),
			flags: MessageFlags.Ephemeral,
		});
	});

	channelControlCollector.on('collect', async (interaction) => {
		channelControlCollector.stop('refresh');

		const selected = interaction.values[0];
		if (!selected) {
			return;
		}

		await interaction.deferReply();
		await dispatchControlSelection(client, t, interaction, channelOwner.id, selected);
		await refreshChannelControls(client, t, interaction, channelOwner, channel);
	});

	client.collectorManager.addChannelControlsCollector(channel.id, channelControlCollector);
}

/**
 * Sets up a message collector that automatically deletes older messages in the channel
 * whenever a new one arrives, keeping at most `messagesToKeep` non-control messages.
 * @param client - The bot client, used to register the collector in CollectorManager.
 * @param channel - The voice channel to watch for new messages.
 * @param channelControlMessageId - The ID of the pinned control message, excluded from deletion.
 * @param messagesToKeep - Maximum number of regular messages to retain; pass `null` to disable auto-deletion.
 */
export function createAutoMessageDeletion(
	client: ShiveronClient,
	channel: VoiceChannel,
	channelControlMessageId: string,
	messagesToKeep: number | null,
): void {
	const messageCollector = channel.createMessageCollector({
		filter: (message) => message.id != channelControlMessageId,
	});

	if (messagesToKeep) {
		messageCollector.on('collect', async () => {
			const messages = await channel.messages.fetch({ limit: messagesToKeep + 1 });

			const sortedMessages = messages
				.filter((message) => message.id != channelControlMessageId)
				.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

			if (sortedMessages.size > messagesToKeep) {
				const toDelete = new Collection(
					sortedMessages.first(sortedMessages.size - messagesToKeep).map((m) => [m.id, m]),
				);

				const [bulkDeletableMessages, notBulkDeletableMessages] = toDelete.partition(
					(message) => message.bulkDeletable,
				);

				for (const message of notBulkDeletableMessages) {
					if (message instanceof Message) {
						message.delete();
					}
				}
				channel.bulkDelete(bulkDeletableMessages);
			}
		});
	}

	client.collectorManager.addMessageCollector(channel.id, messageCollector);
}

/**
 * Routes a control menu selection to the handler that implements it.
 * @param client - The bot client instance.
 * @param t - Translation function for the guild's locale.
 * @param interaction - The select menu interaction that triggered this action.
 * @param channelOwnerId - The Discord user ID of the channel owner.
 * @param selected - The value of the option the owner picked.
 */
async function dispatchControlSelection(
	client: ShiveronClient,
	t: Translator,
	interaction: StringSelectMenuInteraction,
	channelOwnerId: string,
	selected: string,
): Promise<void> {
	const toggle = PERMISSION_TOGGLES[selected];
	if (toggle) {
		await processPermissionToggle(client, interaction, t, channelOwnerId, toggle);
		return;
	}

	switch (selected) {
		case 'name_change': {
			await processNameChange(client, interaction, t, channelOwnerId);
			break;
		}
		case 'private_channel': {
			await processPrivateChannel(client, interaction, t, channelOwnerId);
			break;
		}
		case 'blacklist': {
			await processACL(client, interaction, t, channelOwnerId, true);
			break;
		}
		case 'whitelist': {
			await processACL(client, interaction, t, channelOwnerId, false);
			break;
		}
		case 'messages_deletion': {
			await processMessageDeletion(client, interaction, t, channelOwnerId);
			break;
		}
	}
}

/**
 * Rebuilds and edits the channel control message after an option change, then re-attaches the collector.
 * @param client - The bot client instance.
 * @param t - Translation function for the guild's locale.
 * @param interaction - The select menu interaction whose message is updated.
 * @param channelOwner - The GuildMember who owns the temp channel.
 * @param channel - The live VoiceChannel instance, used to reflect current permission state.
 */
async function refreshChannelControls(
	client: ShiveronClient,
	t: Translator,
	interaction: StringSelectMenuInteraction,
	channelOwner: GuildMember,
	channel: VoiceChannel,
): Promise<void> {
	const { tempVoice, voiceACL, created } = await client.voiceService.createOrGetTempVoice(
		interaction.guild!.id,
		channelOwner,
	);

	const { menuText, menuEmbed, menuRow } = createChannelControlMessage(
		t,
		channelOwner,
		interaction.guild!,
		created,
		tempVoice,
		voiceACL,
		channel,
	);

	const channelControlMessage = await interaction.message.edit({
		content: menuText,
		embeds: [menuEmbed],
		components: [menuRow],
	});

	createAutoMessageDeletion(client, channel, channelControlMessage.id, tempVoice.messagesToKeep);
	attachControlCollector(client, t, channelControlMessage, channelOwner, channel);
}

/**
 * Adds thumbs-up / thumbs-down buttons to a message and waits for the owner to choose
 * whether to save a setting as the new default for future channels.
 * @param t - Translation function for the guild's locale.
 * @param message - The message to append the buttons to.
 * @param targetId - The Discord user ID of the channel owner; only they may press the buttons.
 * @returns `true` if the user confirmed saving as default, `false` otherwise (including timeout).
 */
async function createSetAsDefaultQuestion(t: Translator, message: Message, targetId: string): Promise<boolean> {
	const enable = new ButtonBuilder().setCustomId('enable').setEmoji('👍').setStyle(ButtonStyle.Success);
	const disable = new ButtonBuilder().setCustomId('disable').setEmoji('👎').setStyle(ButtonStyle.Danger);
	const buttonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents([enable, disable]);

	message.edit({ components: [buttonsRow] });

	const buttonPressed = await awaitAuthorizedComponentInteraction(message, targetId, ComponentType.Button);

	if (!buttonPressed) {
		message.reply({ content: t('misc.interaction_expired', { seconds: 60 }) });
		return false;
	}

	await buttonPressed.deferReply();

	if (buttonPressed.customId == 'enable') {
		buttonPressed.editReply({ content: t('temp_voice.process.set_default.success_update') });
		return true;
	}

	buttonPressed.editReply({ content: t('temp_voice.process.set_default.success_not_update') });
	return false;
}

/**
 * Prompts the owner to type a new name for their voice channel, applies it, and optionally saves it as default.
 * @param client - The bot client instance, used to update TempVoice settings.
 * @param interaction - The select menu interaction that triggered this action.
 * @param t - Translation function for the guild's locale.
 * @param channelOwnerId - The Discord user ID of the channel owner; used to filter awaited messages.
 */
async function processNameChange(
	client: ShiveronClient,
	interaction: StringSelectMenuInteraction,
	t: Translator,
	channelOwnerId: string,
): Promise<void> {
	const channel = interaction.channel;

	if (!(channel instanceof VoiceChannel)) {
		return;
	}

	const nameMessage = await interaction.editReply({ content: t('temp_voice.process.name.query_name') });
	const answer = await awaitAuthorizedMessage(channel, channelOwnerId);

	if (!answer) {
		nameMessage.reply({ content: t('misc.interaction_expired', { seconds: 60 }) });
		return;
	}

	if (answer.content.length >= DISCORD_MAX_CHANNEL_NAME_LENGTH) {
		answer.reply({ content: t('temp_voice.process.name.error_length') });
		return;
	}

	channel.setName(answer.content).catch(() => {
		client.logger.warn("Couldn't change the name of a voice channel");
	});

	const setAsDefaultQuestion = await answer.reply({
		content: t('temp_voice.process.name.success', { name: answer.content }),
	});

	if (await createSetAsDefaultQuestion(t, setAsDefaultQuestion, channelOwnerId)) {
		client.voiceService.updateTempVoice({
			guildId: channel.guild.id,
			ownerId: channelOwnerId,
			channelName: answer.content,
		});
	}
}

/**
 * Flips one of the @everyone permission toggles (soundboard, streams, activities) on the live channel
 * and optionally saves the new state as the owner's default.
 * @param client - The bot client instance, used to update TempVoice settings.
 * @param interaction - The select menu interaction that triggered this action.
 * @param t - Translation function for the guild's locale.
 * @param channelOwnerId - The Discord user ID of the channel owner.
 * @param toggle - The definition of the setting being flipped.
 */
async function processPermissionToggle(
	client: ShiveronClient,
	interaction: StringSelectMenuInteraction,
	t: Translator,
	channelOwnerId: string,
	toggle: PermissionToggle,
): Promise<void> {
	const channel = interaction.channel;

	if (!(channel instanceof VoiceChannel)) {
		return;
	}

	const everyone = channel.guild.roles.everyone;
	const enabled = channel.permissionsFor(everyone).has(toggle.permission);

	channel.permissionOverwrites.edit(everyone, toggle.buildOverwrite(!enabled));

	const setAsDefaultQuestion = await interaction.editReply({
		content: t(`temp_voice.process.${toggle.localeKey}.success_${enabled ? 'disable' : 'enable'}`, { channel }),
	});

	if (await createSetAsDefaultQuestion(t, setAsDefaultQuestion, channelOwnerId)) {
		client.voiceService.updateTempVoice({
			guildId: channel.guild.id,
			ownerId: channelOwnerId,
			...toggle.buildUpdate(!enabled),
		});
	}
}

/**
 * Toggles the channel between public and private (hides it from @everyone if private)
 * and optionally saves the new state as default.
 * @param client - The bot client instance, used to update TempVoice settings.
 * @param interaction - The select menu interaction that triggered this action.
 * @param t - Translation function for the guild's locale.
 * @param channelOwnerId - The Discord user ID of the channel owner.
 */
async function processPrivateChannel(
	client: ShiveronClient,
	interaction: StringSelectMenuInteraction,
	t: Translator,
	channelOwnerId: string,
): Promise<void> {
	const channel = interaction.channel;

	if (!(channel instanceof VoiceChannel)) {
		return;
	}

	const everyone = channel.guild.roles.everyone;
	const everyonePermissions = channel.permissionsFor(everyone);
	const isPrivateChannel =
		!everyonePermissions.has(PermissionFlagsBits.ViewChannel) &&
		!everyonePermissions.has(PermissionFlagsBits.Connect);

	channel.permissionOverwrites.edit(everyone, {
		ViewChannel: isPrivateChannel,
		Connect: isPrivateChannel,
	});

	const setAsDefaultQuestion = await interaction.editReply({
		content: t(
			isPrivateChannel
				? 'temp_voice.process.availability.success_public'
				: 'temp_voice.process.availability.success_private',
			{ channel },
		),
	});

	if (await createSetAsDefaultQuestion(t, setAsDefaultQuestion, channelOwnerId)) {
		client.voiceService.updateTempVoice({
			guildId: channel.guild.id,
			ownerId: channelOwnerId,
			privateChannel: !isPrivateChannel,
		});
	}
}

/**
 * Prompts the owner to set a new message retention limit (or type `"none"` to disable auto-deletion)
 * and saves the setting to the database.
 * @param client - The bot client instance, used to update TempVoice settings.
 * @param interaction - The select menu interaction that triggered this action.
 * @param t - Translation function for the guild's locale.
 * @param channelOwnerId - The Discord user ID of the channel owner; used to filter awaited messages.
 */
async function processMessageDeletion(
	client: ShiveronClient,
	interaction: StringSelectMenuInteraction,
	t: Translator,
	channelOwnerId: string,
): Promise<void> {
	const channel = interaction.channel;

	if (!(channel instanceof VoiceChannel)) {
		return;
	}

	const amountMessage = await interaction.editReply({
		content: t('temp_voice.process.messages_kept.query_amount'),
	});
	const answer = await awaitAuthorizedMessage(channel, channelOwnerId);

	if (!answer) {
		amountMessage.reply({ content: t('misc.interaction_expired', { seconds: 60 }) });
		return;
	}

	if (answer.content == 'none') {
		await client.voiceService.updateTempVoice({
			guildId: channel.guildId,
			ownerId: channelOwnerId,
			messagesToKeep: null,
		});

		amountMessage.reply({ content: t('temp_voice.process.messages_kept.success_disable') });
	} else if (!isNaN(Number(answer.content))) {
		await client.voiceService.updateTempVoice({
			guildId: channel.guildId,
			ownerId: channelOwnerId,
			messagesToKeep: parseInt(answer.content),
		});

		amountMessage.reply({
			content: t('temp_voice.process.messages_kept.success', { amount: answer.content }),
		});
	} else {
		amountMessage.reply({ content: t('temp_voice.process.messages_kept.error_value') });
	}
}

/**
 * Presents a user select menu to add/remove members from the channel's whitelist or blacklist.
 * Toggling an already-listed member removes them; otherwise adds them with the corresponding permission override.
 * @param client - The bot client instance, used to update VoiceACL records.
 * @param interaction - The select menu interaction that triggered this action.
 * @param t - Translation function for the guild's locale.
 * @param channelOwnerId - The Discord user ID of the channel owner; used to restrict interaction access.
 * @param blacklist - `true` to manage the blacklist (deny access), `false` to manage the whitelist (grant access).
 */
async function processACL(
	client: ShiveronClient,
	interaction: StringSelectMenuInteraction,
	t: Translator,
	channelOwnerId: string,
	blacklist: boolean,
): Promise<void> {
	const channel = interaction.channel;

	if (!(channel instanceof VoiceChannel)) {
		return;
	}

	const listKey = blacklist ? 'blacklist' : 'whitelist';

	const memberSelect = new UserSelectMenuBuilder()
		.setCustomId('blacklist')
		.setPlaceholder(t('misc.user_selection'))
		.setMinValues(1)
		.setMaxValues(DISCORD_SELECT_MENU_MAX_VALUES);
	const rowSelection = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(memberSelect);

	const selectionMessage = await interaction.editReply({
		content: t(`temp_voice.process.${listKey}.query_users`, { channel }),
		components: [rowSelection],
	});

	const selectedUsers = (await awaitAuthorizedComponentInteraction(
		selectionMessage,
		channelOwnerId,
		ComponentType.UserSelect,
	)) as UserSelectMenuInteraction;

	if (!selectedUsers) {
		selectionMessage.reply({ content: t('misc.interaction_expired', { seconds: 60 }) });
		return;
	}

	await selectedUsers.deferReply();
	let response = '';

	const voiceACL = await client.voiceService.getVoiceACLForTempVoice(interaction.guildId!, channelOwnerId);

	for (const userId of selectedUsers.values) {
		const user = await channel.guild.members.fetch(userId);
		const existingEntry = voiceACL.find((entry) => entry.memberId == userId);
		const isOnTargetList = existingEntry && existingEntry.hasAccess == !blacklist;

		if (isOnTargetList) {
			channel.permissionOverwrites.delete(userId);
			response += t(`temp_voice.process.${listKey}.success_remove`, { user });
			client.voiceService.deleteVoiceACL(channel.guild.id, channelOwnerId, user.id);
		} else {
			channel.permissionOverwrites.edit(user, {
				ViewChannel: !blacklist,
				Connect: !blacklist,
			});
			response += t(`temp_voice.process.${listKey}.success_add`, { user });
			client.voiceService.createOrUpdateVoiceACL(channel.guild.id, channelOwnerId, user.id, !blacklist);
		}
	}

	selectedUsers.editReply({ content: response });
}
