import { VoiceState } from 'discord.js';
import AsyncLock from 'async-lock';
import { BaseEvent } from '../core/BaseEvent.js';
import { ShiveronClient } from '../core/ShiveronClient.js';
import { handleVoiceChannelJoin, handleVoiceChannelLeave } from './voice/lifecycle.js';

/**
 * Handles all voice state changes (joins, leaves, channel switches) to manage temporary voice channels. The work itself lives in `./voice/`: channel creation, deletion and ownership transfer in `lifecycle`, and the owner's control panel in `controls`.
 */
export default class VoiceStateUpdateEvent extends BaseEvent<'voiceStateUpdate'> {
	public readonly name = 'voiceStateUpdate';
	public once = false;
	private lock = new AsyncLock();

	/**
	 * Entry point for voice state changes. Acquires a per-channel lock to prevent race conditions, then delegates to join/leave handlers if the member actually changed channels.
	 * @param client - The bot client instance.
	 * @param oldState - The member's voice state before the change.
	 * @param newState - The member's voice state after the change.
	 */
	public async execute(client: ShiveronClient, oldState: VoiceState, newState: VoiceState): Promise<void> {
		const channelId = newState.channelId || oldState.channelId;

		if (channelId && oldState.channelId != newState.channelId) {
			await this.lock
				.acquire(channelId, async () => {
					try {
						const currentGuildOld = await client.guildSettingsService.createOrGetGuildSettings(
							oldState.guild.id,
						);
						const currentGuildNew = await client.guildSettingsService.createOrGetGuildSettings(
							newState.guild.id,
						);

						if (currentGuildNew.tempChannelId) {
							const t = (path: string, vars: Record<string, any> = {}) =>
								client.i18n.translate(currentGuildNew.lang, path, vars);
							await handleVoiceChannelJoin(client, t, newState, currentGuildNew);
						}
						if (currentGuildOld.tempChannelId) {
							const t = (path: string, vars: Record<string, any> = {}) =>
								client.i18n.translate(currentGuildOld.lang, path, vars);
							await handleVoiceChannelLeave(client, t, oldState, currentGuildOld);
						}
					} catch (error) {
						client.logger.error(`Failed to process ${this.name} : ${error}`);
					}
				})
				.catch((error) => client.logger.error(`Lock Error : ${error}`));
		}
	}
}
