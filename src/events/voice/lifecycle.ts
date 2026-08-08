import { ChannelType, Guild, GuildChannelManager, GuildMember, VoiceChannel, VoiceState } from 'discord.js';
import { type Translator } from '../../core/I18N.js';
import { ShiveronClient } from '../../core/ShiveronClient.js';
import { GuildSettings } from '../../models/GuildSettings.js';
import { createChannelControlMessage } from './controlMessage.js';
import { buildUserVoicePermissions } from './permissions.js';
import { attachControlCollector, createAutoMessageDeletion } from './controls.js';

/**
 * Handles a member joining a voice channel. Creates a new temp channel if they joined the trigger channel, or adds them to the successor list if they joined an existing temp channel.
 * @param client - The bot client instance.
 * @param t - Translation function for the guild's locale.
 * @param newState - The member's new voice state (channel they joined).
 * @param guildSettings - The guild settings, used to identify the temp channel trigger.
 */
export async function handleVoiceChannelJoin(
	client: ShiveronClient,
	t: Translator,
	newState: VoiceState,
	guildSettings: GuildSettings,
): Promise<void> {
	if (!newState.member || !newState.channelId) {
		return;
	}

	if (newState.channelId == guildSettings.tempChannelId) {
		try {
			const newChannelId = await createTempChannel(client, t, newState);
			client.logger.debug(
				`Created a new temporary voice channel ${newChannelId} in guild ${newState.guild.id} for user ${newState.member.id}`,
			);
		} catch (error) {
			client.logger.error('An error occured while creating a new temporary voice channel');
			throw error;
		}

		return;
	}

	const tempVoice = await client.voiceService.findTempVoiceInGuild(newState.guild.id, newState.channelId);

	if (tempVoice && newState.member.id != tempVoice.ownerId) {
		tempVoice.successorIds.push(newState.member.id);
		client.voiceService.updateTempVoice({
			guildId: tempVoice.guildId,
			ownerId: tempVoice.ownerId,
			successorIds: tempVoice.successorIds,
		});
		client.logger.debug(
			`Added user ${newState.member.id} to the successor list of channel ${newState.channelId} in guild ${newState.guild.id}`,
		);
	}
}

/**
 * Handles a member leaving a voice channel. Deletes the temp channel if empty, transfers ownership if the owner left while others remain, or removes the member from the successor list.
 * @param client - The bot client instance.
 * @param t - Translation function for the guild's locale.
 * @param oldState - The member's old voice state (channel they left).
 * @param guildSettings - The guild settings for the guild of the channel that was left.
 */
export async function handleVoiceChannelLeave(
	client: ShiveronClient,
	t: Translator,
	oldState: VoiceState,
	guildSettings: GuildSettings,
): Promise<void> {
	if (!oldState.member || !(oldState.channel instanceof VoiceChannel)) {
		return;
	}

	const tempVoice = await client.voiceService.getTempVoiceByChannelId(oldState.channelId!);
	if (!tempVoice) {
		return;
	}

	if (oldState.channel.members.size == 0) {
		try {
			await deleteTempChannel(
				client,
				oldState.guild.id,
				oldState.guild.channels,
				oldState.member.id,
				oldState.channel,
				guildSettings.tempChannelId!,
			);
			client.logger.debug(
				`Deleted a temporary voice channel ${oldState.channel.id} in guild ${oldState.guild.id}`,
			);
		} catch (error) {
			client.logger.error('An error occured while deleting a temporary voice channel');
			throw error;
		}
	} else if (oldState.member.id == tempVoice.ownerId) {
		try {
			const newOwnerId = await changeTempChannelOwner(
				client,
				t,
				oldState.guild,
				tempVoice.ownerId,
				tempVoice.successorIds,
				guildSettings.tempChannelId!,
				oldState.channel,
				tempVoice.channelControlMessageId!,
			);
			client.logger.debug(
				`Transferred ownership of a temporary voice channel ${oldState.channel.id} in guild ${oldState.guild.id} from ${tempVoice.ownerId} to ${newOwnerId}`,
			);
		} catch (error) {
			client.logger.error('An error occured while transfering ownership of a temporary voice channel');
			throw error;
		}
	} else {
		const index = tempVoice.successorIds.indexOf(oldState.member.id);
		if (index != -1) {
			tempVoice.successorIds.splice(index, 1);
			client.voiceService.updateTempVoice({
				guildId: tempVoice.guildId,
				ownerId: tempVoice.ownerId,
				successorIds: tempVoice.successorIds,
			});
			client.logger.debug(
				`Removed user ${oldState.member.id} from the successor list of channel ${oldState.channelId} in guild ${oldState.guild.id}`,
			);
		}
	}
}

/**
 * Creates a new temporary voice channel for the joining member, applying their saved settings and ACL. Sends the channel control message and sets up the message deletion and control collectors.
 * @param client - The bot client instance.
 * @param t - Translation function for the guild's locale.
 * @param newState - The member's new voice state, used to get the guild and member.
 * @returns The ID of the newly created voice channel.
 */
async function createTempChannel(client: ShiveronClient, t: Translator, newState: VoiceState): Promise<string> {
	const member = newState.member!;
	const { tempVoice, voiceACL, created } = await client.voiceService.createOrGetTempVoice(newState.guild.id, member);

	const newChannel = await newState.guild.channels.create({
		name: tempVoice.channelName,
		parent: newState.channel!.parentId,
		type: ChannelType.GuildVoice,
		permissionOverwrites: buildUserVoicePermissions(
			member.id,
			newState.guild.roles.everyone.id,
			tempVoice,
			voiceACL,
		),
	});

	newState.channel?.permissionOverwrites.create(member, {
		Connect: false,
	});

	newState.setChannel(newChannel);

	const { menuText, menuEmbed, menuRow } = createChannelControlMessage(
		t,
		member,
		newState.guild,
		created,
		tempVoice,
		voiceACL,
		newChannel,
	);

	const channelControlMessage = await newChannel.send({
		content: menuText,
		embeds: [menuEmbed],
		components: [menuRow],
	});

	client.voiceService.updateTempVoice({
		guildId: newState.guild.id,
		ownerId: member.id,
		channelId: newChannel.id,
		channelControlMessageId: channelControlMessage.id,
	});

	createAutoMessageDeletion(client, newChannel, channelControlMessage.id, tempVoice.messagesToKeep);
	attachControlCollector(client, t, channelControlMessage, member, newChannel);

	return newChannel.id;
}

/**
 * Deletes the Discord voice channel and cleans up the associated database state.
 * @param client - The bot client instance.
 * @param guildId - The Discord guild ID.
 * @param channels - The guild's channel manager, used to remove the owner's permission override from the trigger channel.
 * @param ownerId - The Discord user ID of the channel owner.
 * @param tempChannel - The VoiceChannel to delete.
 * @param triggerChannelId - The ID of the trigger channel, used to remove the owner's Connect deny override.
 */
async function deleteTempChannel(
	client: ShiveronClient,
	guildId: string,
	channels: GuildChannelManager,
	ownerId: string,
	tempChannel: VoiceChannel,
	triggerChannelId: string,
): Promise<void> {
	tempChannel.delete();

	await cleanupTempChannel(client, guildId, ownerId, channels, triggerChannelId);
}

/**
 * Transfers ownership of a temp channel to the next person in the successor list (or the first member in the channel). Applies the new owner's saved settings, updates the control message, and sets up fresh collectors.
 * @param client - The bot client instance.
 * @param t - Translation function for the guild's locale.
 * @param guild - The guild the channel belongs to.
 * @param oldOwnerId - The Discord user ID of the departing owner.
 * @param successorIds - The ordered list of successor user IDs; first entry becomes the new owner.
 * @param triggerChannelId - The ID of the trigger channel, used to update the new owner's Connect override.
 * @param channel - The live VoiceChannel instance being transferred.
 * @param channelControlMessageId - The ID of the pinned control message to update.
 * @returns The Discord user ID of the new owner.
 */
async function changeTempChannelOwner(
	client: ShiveronClient,
	t: Translator,
	guild: Guild,
	oldOwnerId: string,
	successorIds: string[],
	triggerChannelId: string,
	channel: VoiceChannel,
	channelControlMessageId: string,
): Promise<string> {
	let newOwnerId = successorIds[0];

	await cleanupTempChannel(client, guild.id, oldOwnerId, guild.channels, triggerChannelId);

	let newOwner: GuildMember;
	if (newOwnerId != undefined) {
		newOwner = await guild.members.fetch(newOwnerId);
	} else {
		newOwner = channel.members.first()!;
		newOwnerId = newOwner.id;
	}

	const { tempVoice, voiceACL, created } = await client.voiceService.createOrGetTempVoice(guild.id, newOwner);

	channel.setName(tempVoice.channelName).catch(() => {
		client.logger.warn("Couldn't change the name of a voice channel");
	});
	await channel.permissionOverwrites.set(
		buildUserVoicePermissions(newOwnerId, guild.roles.everyone.id, tempVoice, voiceACL),
	);

	const triggerChannel = await guild.channels.fetch(triggerChannelId);

	if (triggerChannel instanceof VoiceChannel) {
		triggerChannel.permissionOverwrites.create(newOwner, {
			Connect: false,
		});
	}

	const { menuText, menuEmbed, menuRow } = createChannelControlMessage(
		t,
		newOwner,
		guild,
		created,
		tempVoice,
		voiceACL,
		channel,
	);

	const channelControlMessage = await channel.messages.fetch(channelControlMessageId);

	channelControlMessage.edit({
		content: menuText,
		embeds: [menuEmbed],
		components: [menuRow],
	});

	client.voiceService.updateTempVoice({
		guildId: guild.id,
		ownerId: newOwnerId,
		channelId: channel.id,
		channelControlMessageId: channelControlMessageId,
		successorIds: successorIds.slice(1),
	});

	createAutoMessageDeletion(client, channel, channelControlMessage.id, tempVoice.messagesToKeep);
	attachControlCollector(client, t, channelControlMessage, newOwner, channel);

	channel.send({ content: t('temp_voice.owner_change', { user: newOwner }) });

	return newOwnerId;
}

/**
 * Resets the database state for a temp channel (clears channelId, successor list, etc.) and removes the owner's Connect deny override from the trigger channel.
 * @param client - The bot client instance.
 * @param guildId - The Discord guild ID.
 * @param ownerId - The Discord user ID of the channel owner whose state should be cleared.
 * @param channels - The guild's channel manager, used to fetch and modify the trigger channel.
 * @param triggerChannelId - The ID of the trigger channel, used to remove the owner's permission override.
 */
async function cleanupTempChannel(
	client: ShiveronClient,
	guildId: string,
	ownerId: string,
	channels: GuildChannelManager,
	triggerChannelId: string,
): Promise<void> {
	client.voiceService.updateTempVoice({
		guildId,
		ownerId,
		channelId: null,
		channelControlMessageId: null,
		successorIds: [],
	});

	const triggerChannel = await channels.fetch(triggerChannelId);

	if (triggerChannel instanceof VoiceChannel) {
		triggerChannel.permissionOverwrites.delete(ownerId);
	}
}
