import { Op } from 'sequelize';
import { Infraction } from '../models/Infractions.js';
import { ModerationAction } from '../utils/discord/moderation.js';
import { ShiveronClient } from '../core/ShiveronClient.js';
import { ShiveronLogger } from '../core/ShiveronLogger.js';

export interface CreateInfractionData {
	userId: string;
	guildId: string;
	enforcerId: string;
	type: ModerationAction;
	reason?: string | null;
	endDate?: Date | null;
	ended?: boolean | null;
}

/** Handles all database operations related to moderation infractions and their expiry lifecycle. */
export class InfractionService {
	private logger: ShiveronLogger;

	/**
	 * @param logger - Logger instance used to report operations and errors.
	 */
	public constructor(logger: ShiveronLogger) {
		this.logger = logger;
	}

	/**
	 * Creates a new infraction record in the database.
	 * @param data - The infraction data including userId, guildId, enforcerId, type, and optional reason/endDate/ended.
	 * @returns The newly created Infraction instance.
	 */
	public async createInfraction(data: CreateInfractionData): Promise<Infraction> {
		try {
			const infraction = await Infraction.create(data);
			this.logger.debug(`Created ${data.type} infraction for user ${data.userId} in guild ${data.guildId}.`);
			return infraction;
		} catch (error) {
			this.logger.debug('Failed to create new infraction.');
			throw error;
		}
	}

	/**
	 * Fetches a single infraction by its primary key.
	 * @param id - The numeric ID of the infraction.
	 * @returns The Infraction instance, or `null` if not found.
	 */
	public async getInfractionById(id: number): Promise<Infraction | null> {
		return Infraction.findByPk(id);
	}

	/**
	 * Returns all infractions that have an `endDate` in the past and are not yet marked as ended. Used by the periodic expiry check.
	 */
	public async getExpiredInfractions(): Promise<Infraction[]> {
		const now = new Date();
		return Infraction.findAll({
			where: {
				ended: false,
				endDate: { [Op.lte]: now },
			},
		});
	}

	/**
	 * Returns all infractions for a specific user in a specific guild.
	 * @param userId - The Discord user ID.
	 * @param guildId - The Discord guild ID.
	 */
	public async getUserInfractions(userId: string, guildId: string): Promise<Infraction[]> {
		return Infraction.findAll({
			where: {
				userId: userId,
				guildId: guildId,
			},
		});
	}

	/**
	 * Counts how many infractions of a given type a user has in a specific guild.
	 * @param userId - The Discord user ID.
	 * @param guildId - The Discord guild ID.
	 * @param type - The type of infraction to count (e.g., WARN, BAN).
	 */
	public async countUserInfractionsByType(userId: string, guildId: string, type: ModerationAction): Promise<number> {
		return Infraction.count({
			where: {
				userId: userId,
				guildId: guildId,
				type: type,
			},
		});
	}

	/**
	 * Updates specific fields of an existing infraction.
	 * @param id - The numeric ID of the infraction to update.
	 * @param updates - Partial infraction data containing only the fields to update.
	 * @returns The updated Infraction instance, or `null` if the infraction was not found.
	 */
	public async updateInfraction(id: number, updates: Partial<CreateInfractionData>): Promise<Infraction | null> {
		try {
			const [affectedCount] = await Infraction.update(updates, { where: { id } });
			if (affectedCount == 0) {
				return null;
			}
			return this.getInfractionById(id);
		} catch (error) {
			this.logger.error(`Failed to update infraction n°${id}.`);
			throw error;
		}
	}

	/**
	 * Marks an infraction as ended (i.e., the temporary action has expired or been resolved).
	 * @param id - The numeric ID of the infraction to mark as ended.
	 * @returns The updated Infraction instance, or `null` if not found.
	 */
	public async markAsEnded(id: number): Promise<Infraction | null> {
		return this.updateInfraction(id, { ended: true });
	}

	/**
	 * Permanently deletes an infraction record from the database.
	 * @param id - The numeric ID of the infraction to delete.
	 * @returns `true` if a row was deleted, `false` if nothing was found.
	 */
	public async deleteInfraction(id: number): Promise<boolean> {
		const affectedCount = await Infraction.destroy({ where: { id } });
		return affectedCount > 0;
	}

	/**
	 * Fetches all expired infractions and processes each one (e.g., removing bans). Called on a recurring interval from the client.
	 * @param client - The bot client, used to perform guild/member actions like removing bans.
	 */
	public async checkExpiredInfractions(client: ShiveronClient): Promise<void> {
		this.logger.info('Checking for expired infractions ...');

		const expiredInfractions = await this.getExpiredInfractions();

		let processedCount = 0;
		for (const infraction of expiredInfractions) {
			try {
				await this.processExpiredInfraction(client, infraction);
				processedCount++;
			} catch (error) {
				this.logger.error(`Error while processing expired infractions : ${error}`);
			}
		}

		if (processedCount > 0) {
			this.logger.info(`Finished processing ${processedCount} expired infractions.`);
		} else {
			this.logger.info('No expired infractions to process.');
		}
	}

	/**
	 * Handles the expiry of a single infraction: marks it as ended and, for bans, removes the Discord ban.
	 * @param client - The bot client, used to access guild ban lists.
	 * @param infraction - The expired Infraction record to process.
	 */
	public async processExpiredInfraction(client: ShiveronClient, infraction: Infraction): Promise<void> {
		this.markAsEnded(infraction.id);

		if (infraction.type == ModerationAction.BAN) {
			const guild = await client.guilds.fetch(infraction.guildId);
			const result = await guild.bans.remove(infraction.userId);
			if (result) {
				this.logger.debug(`Removed ban for user ${infraction.userId} in guild ${infraction.guildId}.`);
			}
		} else {
			this.logger.debug(
				`Removed ${infraction.type} for user ${infraction.userId} in guild ${infraction.guildId}.`,
			);
		}
	}
}
