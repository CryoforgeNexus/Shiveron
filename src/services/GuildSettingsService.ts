import { GuildSettings } from '../models/GuildSettings.js';
import { ShiveronLogger } from '../core/ShiveronLogger.js';

export interface CreateGuildSettingsData {
	guildId: string;
	joinChannelId?: string | null;
	joinMessage?: string | null;
	leaveChannelId?: string | null;
	leaveMessage?: string | null;
	logsChannelId?: string | null;
	tempChannelId?: string | null;
	maxWarnings?: number | null;
	lang?: string;
	autoTranslate?: boolean;
	autoTranslateBlacklist?: string[] | null;
	autoTranslateUserBlacklist?: string[] | null;
	autoTranslateRoleBlacklist?: string[] | null;
	boostChannelId?: string | null;
	boostMessage?: string | null;
	banChannelId?: string | null;
	banMessage?: string | null;
}

/**
 * Handles all database operations related to per-guild settings.
 *
 * Settings are read on nearly every message and voice state change, so rows are cached in memory after the first read. This service is the only writer, so the cache is invalidated from the update and delete paths and cannot go stale on its own. The cache is per-process: running more than one bot instance against the same database would need it replaced with a shared store.
 */
export class GuildSettingsService {
	private logger: ShiveronLogger;
	private cache = new Map<string, GuildSettings>();

	/**
	 * @param logger - Logger instance used to report operations and errors.
	 */
	public constructor(logger: ShiveronLogger) {
		this.logger = logger;
	}

	/**
	 * Retrieves the settings for a guild, or creates a new row with defaults if none exist. Served from the in-memory cache when the guild has already been read.
	 * @param guildId - The Discord guild ID to look up or create settings for.
	 * @returns The GuildSettings instance for the guild.
	 */
	public async createOrGetGuildSettings(guildId: string): Promise<GuildSettings> {
		const cached = this.cache.get(guildId);
		if (cached) {
			return cached;
		}

		try {
			const [settings, created] = await GuildSettings.findOrCreate({
				where: { guildId },
				defaults: {
					guildId,
					joinChannelId: null,
					joinMessage: null,
					leaveChannelId: null,
					leaveMessage: null,
					logsChannelId: null,
					tempChannelId: null,
					maxWarnings: null,
					lang: 'en',
					autoTranslate: false,
					autoTranslateBlacklist: null,
					autoTranslateUserBlacklist: null,
					autoTranslateRoleBlacklist: null,
					boostChannelId: null,
					boostMessage: null,
					banChannelId: null,
					banMessage: null,
				},
			});
			if (created) {
				this.logger.debug(`Created settings for guild ${guildId}.`);
			}

			this.cache.set(guildId, settings);
			return settings;
		} catch (error) {
			this.logger.error(`Failed to create / get settings for guild ${guildId}.`);
			throw error;
		}
	}

	/**
	 * Returns `true` if either a join or leave channel is configured for the guild (i.e. the departure message feature is on).
	 * @param guildId - The Discord guild ID to check.
	 */
	public async isDepartureOn(guildId: string): Promise<boolean> {
		const guild = await this.getGuildSettingsById(guildId);
		return guild?.joinChannelId != null || guild?.leaveChannelId != null || guild?.banChannelId != null;
	}

	/**
	 * Returns `true` if a temp voice creation channel is configured for the guild.
	 * @param guildId - The Discord guild ID to check.
	 */
	public async isTempVoiceOn(guildId: string): Promise<boolean> {
		const guild = await this.getGuildSettingsById(guildId);
		return guild?.tempChannelId != null;
	}

	/**
	 * Returns `true` if a max warnings threshold is configured for the guild.
	 * @param guildId - The Discord guild ID to check.
	 */
	public async isMaxWarningsOn(guildId: string): Promise<boolean> {
		const guild = await this.getGuildSettingsById(guildId);
		return guild?.maxWarnings != null;
	}

	/**
	 * Returns `true` if a boost message channel is configured for the guild.
	 * @param guildId - The Discord guild ID to check.
	 */
	public async isBoostOn(guildId: string): Promise<boolean> {
		const guild = await this.getGuildSettingsById(guildId);
		return guild?.boostChannelId != null;
	}

	/**
	 * Returns `true` if a ban message channel is configured for the guild.
	 * @param guildId - The Discord guild ID to check.
	 */
	public async isBanMessageOn(guildId: string): Promise<boolean> {
		const guild = await this.getGuildSettingsById(guildId);
		return guild?.banChannelId != null;
	}

	/**
	 * Returns `true` if auto-translation is enabled for the guild.
	 * @param guildId - The Discord guild ID to check.
	 */
	public async isAutoTranslateOn(guildId: string): Promise<boolean> {
		const guild = await this.getGuildSettingsById(guildId);
		return guild?.autoTranslate === true;
	}

	/**
	 * Fetches the settings row for a specific guild, from the in-memory cache when available. A guild with no row is not cached, so a later creation is picked up immediately.
	 * @param guildId - The Discord guild ID to query.
	 * @returns The GuildSettings instance, or `null` if not found.
	 */
	public async getGuildSettingsById(guildId: string): Promise<GuildSettings | null> {
		const cached = this.cache.get(guildId);
		if (cached) {
			return cached;
		}

		const settings = await GuildSettings.findOne({ where: { guildId } });
		if (settings) {
			this.cache.set(guildId, settings);
		}

		return settings;
	}

	/**
	 * Deletes the settings row for a guild (e.g. when the bot is removed from the guild).
	 * @param guildId - The Discord guild ID whose settings should be deleted.
	 * @returns `true` if a row was deleted, `false` if nothing was found.
	 */
	public async deleteGuildSettings(guildId: string): Promise<boolean> {
		const amountDeleted = await GuildSettings.destroy({
			where: { guildId },
		});
		this.cache.delete(guildId);
		return amountDeleted > 0;
	}

	/**
	 * Updates one or more fields in a guild's settings row, then refreshes the cached copy.
	 * @param updates - An object containing `guildId` and any fields to update.
	 * @returns The updated GuildSettings instance, or `null` if the guild was not found.
	 */
	public async updateGuildSettings(updates: CreateGuildSettingsData): Promise<GuildSettings | null> {
		try {
			const [affectedCount] = await GuildSettings.update(updates, { where: { guildId: updates.guildId } });
			this.cache.delete(updates.guildId);
			if (affectedCount == 0) {
				return null;
			}
			const guildSettings = await this.getGuildSettingsById(updates.guildId);
			return guildSettings;
		} catch (error) {
			this.logger.error(`Failed to update guild settings for guild ${updates.guildId}.`);
			throw error;
		}
	}
}
