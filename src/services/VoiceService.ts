import { GuildMember } from 'discord.js';
import { TempVoice } from '../models/TempVoice.js';
import { VoiceACL } from '../models/VoiceACL.js';
import { ShiveronLogger } from '../core/ShiveronLogger.js';

export interface CreateTempVoiceData {
	guildId: string;
	ownerId: string;
	channelId?: string | null;
	channelControlMessageId?: string | null;
	channelName?: string;
	soundBoardEnabled?: boolean;
	streamsEnabled?: boolean;
	activitiesEnabled?: boolean;
	privateChannel?: boolean;
	messagesToKeep?: number | null;
	successorIds?: string[];
}

/** Handles all database operations for temporary voice channels and their access control lists. */
export class VoiceService {
	private logger: ShiveronLogger;

	/**
	 * @param logger - Logger instance used to report operations and errors.
	 */
	public constructor(logger: ShiveronLogger) {
		this.logger = logger;
	}

	/**
	 * Retrieves an existing TempVoice record for the given owner, or creates one with defaults. Also fetches all VoiceACL entries associated with the owner in that guild.
	 * @param guildId - The Discord guild ID.
	 * @param owner - The GuildMember who owns (or will own) the temp channel.
	 * @returns An object with `tempVoice`, `voiceACL`, and `created` (`true` if the record was just created).
	 */
	public async createOrGetTempVoice(
		guildId: string,
		owner: GuildMember,
	): Promise<{ tempVoice: TempVoice; voiceACL: VoiceACL[]; created: boolean }> {
		try {
			const [tempVoice, created] = await TempVoice.findOrCreate({
				where: {
					guildId,
					ownerId: owner.id,
				},
				defaults: {
					guildId,
					ownerId: owner.id,
					channelId: null,
					channelControlMessageId: null,
					channelName: owner.displayName,
					soundBoardEnabled: true,
					streamsEnabled: true,
					activitiesEnabled: true,
					privateChannel: false,
					messagesToKeep: 5,
					successorIds: [],
				},
			});

			const voiceACL = await this.getVoiceACLForTempVoice(guildId, owner.id);

			if (created) {
				this.logger.debug(`Created settings for temp voice for guild ${guildId} and user ${owner.id}.`);
			}

			return { tempVoice, voiceACL, created };
		} catch (error) {
			this.logger.error(`Failed to create / get temp voice for guild ${guildId} and user ${owner.id}.`);
			throw error;
		}
	}

	/**
	 * Looks up a TempVoice record by its active Discord channel ID within a guild.
	 * @param guildId - The Discord guild ID.
	 * @param channelId - The ID of the active voice channel.
	 * @returns The TempVoice instance, or `null` if not found.
	 */
	public async findTempVoiceInGuild(guildId: string, channelId: string): Promise<TempVoice | null> {
		return TempVoice.findOne({ where: { guildId, channelId } });
	}

	/**
	 * Fetches a TempVoice record by its composite primary key (guild + owner).
	 * @param guildId - The Discord guild ID.
	 * @param ownerId - The Discord user ID of the channel owner.
	 * @returns The TempVoice instance, or `null` if not found.
	 */
	public async getTempVoiceByPK(guildId: string, ownerId: string): Promise<TempVoice | null> {
		return TempVoice.findOne({ where: { guildId, ownerId } });
	}

	/**
	 * Fetches a TempVoice record by its active Discord channel ID alone.
	 * @param channelId - The ID of the active voice channel.
	 * @returns The TempVoice instance, or `null` if not found.
	 */
	public async getTempVoiceByChannelId(channelId: string): Promise<TempVoice | null> {
		return TempVoice.findOne({ where: { channelId } });
	}

	/**
	 * Deletes a TempVoice record and all associated VoiceACL entries for the given owner in a guild.
	 * @param guildId - The Discord guild ID.
	 * @param ownerId - The Discord user ID of the channel owner.
	 * @returns `true` if the TempVoice record was deleted, `false` if it was not found.
	 */
	public async deleteTempVoice(guildId: string, ownerId: string): Promise<boolean> {
		const tempVoiceDeleted = await TempVoice.destroy({
			where: {
				guildId,
				ownerId,
			},
		});

		await VoiceACL.destroy({
			where: {
				guildId,
				ownerId,
			},
		});

		return tempVoiceDeleted > 0;
	}

	/**
	 * Updates specific fields of an existing TempVoice record.
	 * @param updates - An object containing `guildId` and `ownerId` (used to locate the record) plus any fields to update.
	 * @returns The updated TempVoice instance, or `null` if the record was not found.
	 */
	public async updateTempVoice(updates: CreateTempVoiceData): Promise<TempVoice | null> {
		try {
			const [affectedCount] = await TempVoice.update(updates, {
				where: { guildId: updates.guildId, ownerId: updates.ownerId },
			});
			if (affectedCount == 0) {
				return null;
			}
			const tempVoice = await this.getTempVoiceByPK(updates.guildId, updates.ownerId);
			return tempVoice;
		} catch (error) {
			this.logger.error(
				`Failed to update temp voice with guild id ${updates.guildId} and owner id ${updates.ownerId}.`,
			);
			throw error;
		}
	}

	/**
	 * Creates a new VoiceACL entry for a member, or updates their access if an entry already exists.
	 * @param guildId - The Discord guild ID.
	 * @param ownerId - The Discord user ID of the channel owner.
	 * @param memberId - The Discord user ID of the member whose access is being set.
	 * @param hasAccess - `true` to whitelist the member, `false` to blacklist them.
	 * @returns The created or updated VoiceACL instance, or `null` on failure.
	 */
	public async createOrUpdateVoiceACL(
		guildId: string,
		ownerId: string,
		memberId: string,
		hasAccess: boolean,
	): Promise<VoiceACL | null> {
		try {
			const [voiceACL, created] = await VoiceACL.findOrCreate({
				where: { guildId, ownerId, memberId },
				defaults: { guildId, ownerId, memberId, hasAccess },
			});

			if (!created) {
				return this.updateVoiceACL(guildId, ownerId, memberId, hasAccess);
			}
			return voiceACL;
		} catch (error) {
			this.logger.error('Failed to create new VoiceACL');
			throw error;
		}
	}

	/**
	 * Returns all VoiceACL entries for a given owner's temp channel in a guild.
	 * @param guildId - The Discord guild ID.
	 * @param ownerId - The Discord user ID of the channel owner.
	 */
	public async getVoiceACLForTempVoice(guildId: string, ownerId: string): Promise<VoiceACL[]> {
		return VoiceACL.findAll({
			where: { guildId, ownerId },
		});
	}

	/**
	 * Fetches a single VoiceACL entry for a specific member in an owner's channel.
	 * @param guildId - The Discord guild ID.
	 * @param ownerId - The Discord user ID of the channel owner.
	 * @param memberId - The Discord user ID of the member.
	 * @returns The VoiceACL instance, or `null` if not found.
	 */
	public async getVoiceACL(guildId: string, ownerId: string, memberId: string): Promise<VoiceACL | null> {
		return VoiceACL.findOne({ where: { guildId, ownerId, memberId } });
	}

	/**
	 * Updates the `hasAccess` value for an existing VoiceACL entry.
	 * @param guildId - The Discord guild ID.
	 * @param ownerId - The Discord user ID of the channel owner.
	 * @param memberId - The Discord user ID of the member.
	 * @param hasAccess - The new access value to set.
	 * @returns The updated VoiceACL instance, or `null` if not found.
	 */
	public async updateVoiceACL(
		guildId: string,
		ownerId: string,
		memberId: string,
		hasAccess: boolean,
	): Promise<VoiceACL | null> {
		try {
			const [affectedCount] = await VoiceACL.update({ hasAccess }, { where: { guildId, ownerId, memberId } });

			if (affectedCount == 0) {
				return null;
			}
			return this.getVoiceACL(guildId, ownerId, memberId);
		} catch (error) {
			this.logger.error(
				`Failed to update voice access list with guild id ${guildId}, owner id ${ownerId} and member id ${memberId}.`,
			);
			throw error;
		}
	}

	/**
	 * Removes a VoiceACL entry for a specific member from an owner's channel.
	 * @param guildId - The Discord guild ID.
	 * @param ownerId - The Discord user ID of the channel owner.
	 * @param memberId - The Discord user ID of the member to remove.
	 * @returns `true` if the entry was deleted, `false` if it was not found.
	 */
	public async deleteVoiceACL(guildId: string, ownerId: string, memberId: string): Promise<boolean> {
		const affectedCount = await VoiceACL.destroy({ where: { guildId, ownerId, memberId } });
		return affectedCount > 0;
	}
}
