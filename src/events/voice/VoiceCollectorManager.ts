import type { InteractionCollector, MessageCollector, StringSelectMenuInteraction } from 'discord.js';

/** Tracks active message and interaction collectors keyed by voice channel ID, preventing duplicate collectors. */
export class VoiceCollectorManager {
	private messageCollector: Map<string, MessageCollector>;
	private channelControlsCollector: Map<string, InteractionCollector<StringSelectMenuInteraction>>;

	/** Initializes empty maps for message and channel controls collectors. */
	public constructor() {
		this.messageCollector = new Map<string, MessageCollector>();
		this.channelControlsCollector = new Map<string, InteractionCollector<StringSelectMenuInteraction>>();
	}

	/**
	 * Registers a message collector for a channel, stopping any existing one first.
	 * @param channelId - The voice channel ID this collector is attached to.
	 * @param collector - The MessageCollector instance to register.
	 */
	public addMessageCollector(channelId: string, collector: MessageCollector): void {
		this.stopMessageCollector(channelId);
		this.messageCollector.set(channelId, collector);
	}

	/**
	 * Stops and removes the active message collector for a channel, if one exists.
	 * @param channelId - The voice channel ID whose collector should be stopped.
	 * @param reason - The reason passed to `collector.stop()`. Defaults to `"refreshed"`.
	 */
	public stopMessageCollector(channelId: string, reason: string = 'refreshed'): void {
		const collector = this.messageCollector.get(channelId);
		if (collector) {
			collector.stop(reason);
			this.messageCollector.delete(channelId);
		}
	}

	/**
	 * Registers a channel controls (select menu) collector for a channel, stopping any existing one first.
	 * @param channelId - The voice channel ID this collector is attached to.
	 * @param collector - The InteractionCollector for StringSelectMenuInteraction to register.
	 */
	public addChannelControlsCollector(
		channelId: string,
		collector: InteractionCollector<StringSelectMenuInteraction>,
	): void {
		this.stopChannelControlsCollector(channelId);
		this.channelControlsCollector.set(channelId, collector);
	}

	/**
	 * Stops and removes the active channel controls collector for a channel, if one exists.
	 * @param channelId - The voice channel ID whose collector should be stopped.
	 * @param reason - The reason passed to `collector.stop()`. Defaults to `"refreshed"`.
	 */
	public stopChannelControlsCollector(channelId: string, reason: string = 'refreshed'): void {
		const collector = this.channelControlsCollector.get(channelId);
		if (collector) {
			collector.stop(reason);
			this.channelControlsCollector.delete(channelId);
		}
	}
}
