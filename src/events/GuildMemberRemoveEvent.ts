import { GuildMember, type PartialGuildMember, TextChannel } from 'discord.js';
import { BaseEvent } from '../core/BaseEvent.js';
import { ShiveronClient } from '../core/ShiveronClient.js';
import { interpolate } from '../utils/formatters.js';

/** Fires when a member leaves or is removed from a guild. Sends a configured leave message if one is set. */
export default class GuildMemberRemoveEvent extends BaseEvent<'guildMemberRemove'> {
	public readonly name = 'guildMemberRemove';
	public once = false;

	/**
	 * Sends an interpolated leave message to the configured leave channel, if configured for the guild.
	 * @param client - The bot client instance.
	 * @param member - The GuildMember (or PartialGuildMember) who left the server.
	 */
	public async execute(client: ShiveronClient, member: GuildMember | PartialGuildMember): Promise<void> {
		try {
			// Resolved against the API rather than the ban cache. The client does not subscribe to GuildModeration, so no GuildBanRemove event ever evicts a cached entry, and a member who was banned and later unbanned stays cached as banned for the lifetime of the process. A cached read then reports a kicked or departing member as banned and posts the ban message in place of the leave message.
			const isBanned = await member.guild.bans
				.fetch({ user: member.id, force: true })
				.then(() => true)
				.catch(() => false);
			const currentGuild = await client.guildSettingsService.createOrGetGuildSettings(member.guild.id);

			if (isBanned) {
				if (currentGuild.banChannelId && currentGuild.banMessage) {
					const banChannel = (await member.guild.channels.fetch(currentGuild.banChannelId)) as TextChannel;

					banChannel.send(
						interpolate(currentGuild.banMessage, {
							user: member,
							server: member.guild,
						}),
					);

					client.logger.debug(`Processed ban message for ${member.id} in ${member.guild.id}`);
				}
			} else if (currentGuild.leaveChannelId && currentGuild.leaveMessage) {
				const leaveChannel = (await member.guild.channels.fetch(currentGuild.leaveChannelId)) as TextChannel;

				leaveChannel.send(
					interpolate(currentGuild.leaveMessage, {
						user: member,
						server: member.guild,
						memberCount: member.guild.memberCount,
					}),
				);

				client.logger.debug(`Processed guild member ${member.id} departure in ${member.guild.id}`);
			}
		} catch (error) {
			client.logger.error(`Failed to process ${this.name} : ${error}`);
		}
	}
}
