import { DataTypes, Model, type Optional, Sequelize } from 'sequelize';

export interface GuildSettingsAttributes {
	guildId: string;
	joinChannelId: string | null;
	joinMessage: string | null;
	leaveChannelId: string | null;
	leaveMessage: string | null;
	logsChannelId: string | null;
	tempChannelId: string | null;
	maxWarnings: number | null;
	lang: string;
	autoTranslate: boolean;
	autoTranslateBlacklist: string[] | null;
	autoTranslateUserBlacklist: string[] | null;
	autoTranslateRoleBlacklist: string[] | null;
	boostChannelId: string | null;
	boostMessage: string | null;
	banChannelId: string | null;
	banMessage: string | null;
}

export interface GuildSettingsCreationAttributes extends Optional<
	GuildSettingsAttributes,
	| 'joinChannelId'
	| 'joinMessage'
	| 'leaveChannelId'
	| 'leaveMessage'
	| 'logsChannelId'
	| 'tempChannelId'
	| 'maxWarnings'
	| 'lang'
	| 'autoTranslate'
	| 'autoTranslateBlacklist'
	| 'autoTranslateUserBlacklist'
	| 'autoTranslateRoleBlacklist'
	| 'boostChannelId'
	| 'boostMessage'
	| 'banChannelId'
	| 'banMessage'
> {}

export class GuildSettings
	extends Model<GuildSettingsAttributes, GuildSettingsCreationAttributes>
	implements GuildSettingsAttributes
{
	declare guildId: string;
	declare joinChannelId: string | null;
	declare joinMessage: string | null;
	declare leaveChannelId: string | null;
	declare leaveMessage: string | null;
	declare logsChannelId: string | null;
	declare tempChannelId: string | null;
	declare maxWarnings: number | null;
	declare lang: string;
	declare autoTranslate: boolean;
	declare autoTranslateBlacklist: string[] | null;
	declare autoTranslateUserBlacklist: string[] | null;
	declare autoTranslateRoleBlacklist: string[] | null;
	declare boostChannelId: string | null;
	declare boostMessage: string | null;
	declare banChannelId: string | null;
	declare banMessage: string | null;

	declare readonly createdAt: Date;
	declare readonly updatedAt: Date;

	/**
	 * Defines the GuildSettings model schema and binds it to the given Sequelize instance.
	 * @param sequelize - The Sequelize instance to associate this model with.
	 */
	public static initialize(sequelize: Sequelize): void {
		GuildSettings.init(
			{
				guildId: {
					type: DataTypes.STRING,
					primaryKey: true,
				},
				joinChannelId: {
					type: DataTypes.STRING,
					allowNull: true,
				},
				joinMessage: {
					type: DataTypes.STRING,
					allowNull: true,
				},
				leaveChannelId: {
					type: DataTypes.STRING,
					allowNull: true,
				},
				leaveMessage: {
					type: DataTypes.STRING,
					allowNull: true,
				},
				logsChannelId: {
					type: DataTypes.STRING,
					allowNull: true,
				},
				tempChannelId: {
					type: DataTypes.STRING,
					allowNull: true,
				},
				maxWarnings: {
					type: DataTypes.INTEGER,
					allowNull: true,
				},
				lang: {
					type: DataTypes.STRING,
					allowNull: false,
					defaultValue: 'en',
				},
				autoTranslate: {
					type: DataTypes.BOOLEAN,
					allowNull: false,
					defaultValue: false,
				},
				autoTranslateBlacklist: {
					type: DataTypes.ARRAY(DataTypes.STRING),
					allowNull: true,
				},
				autoTranslateUserBlacklist: {
					type: DataTypes.ARRAY(DataTypes.STRING),
					allowNull: true,
				},
				autoTranslateRoleBlacklist: {
					type: DataTypes.ARRAY(DataTypes.STRING),
					allowNull: true,
				},
				boostChannelId: {
					type: DataTypes.STRING,
					allowNull: true,
				},
				boostMessage: {
					type: DataTypes.STRING,
					allowNull: true,
				},
				banChannelId: {
					type: DataTypes.STRING,
					allowNull: true,
				},
				banMessage: {
					type: DataTypes.STRING,
					allowNull: true,
				},
			},
			{
				tableName: 'guildSettings',
				sequelize,
				timestamps: true,
				indexes: [{ fields: ['guildId'] }],
			},
		);
	}
}
