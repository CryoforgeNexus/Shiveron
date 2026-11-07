import { EmbedBuilder, type OmitPartialGroupDMChannel, type Message } from 'discord.js';
import { BaseEvent } from '../core/BaseEvent.js';
import { ShiveronClient } from '../core/ShiveronClient.js';
import { TRANSLATION_MIN_CONFIDENCE, TRANSLATION_MIN_MESSAGE_LENGTH } from '../utils/constants.js';
import { langCodeToFlagEmoji } from '../utils/flagLanguageMap.js';

/** Fires on every new message. Auto-translates to the guild language when a different language is detected. */
export default class MessageCreateEvent extends BaseEvent<'messageCreate'> {
	public readonly name = 'messageCreate';
	public once = false;

	/**
	 * Checks the language of every non-bot guild message outside the blacklisted channels, users and roles. If it differs from the guild's configured language and LibreTranslate is confident enough, replies with a translation embed.
	 * @param client - The bot client instance.
	 * @param message - The newly created message.
	 */
	public async execute(client: ShiveronClient, message: OmitPartialGroupDMChannel<Message>): Promise<void> {
		if (!message.author.bot && message.guildId && message.content.length >= TRANSLATION_MIN_MESSAGE_LENGTH) {
			try {
				const currentGuild = await client.guildSettingsService.createOrGetGuildSettings(message.guildId);

				const blacklistedRoles = currentGuild.autoTranslateRoleBlacklist ?? [];
				const isBlacklisted =
					currentGuild.autoTranslateBlacklist?.includes(message.channelId) ||
					currentGuild.autoTranslateUserBlacklist?.includes(message.author.id) ||
					message.member?.roles.cache.hasAny(...blacklistedRoles);

				if (currentGuild.autoTranslate && currentGuild.lang && !isBlacklisted) {
					const [detectedLanguage] = await client.libreTranslate.detect(message.content);

					if (
						detectedLanguage &&
						detectedLanguage.language != currentGuild.lang &&
						detectedLanguage.confidence >= TRANSLATION_MIN_CONFIDENCE
					) {
						const { translatedText } = await client.libreTranslate.translate(
							message.content,
							currentGuild.lang,
							detectedLanguage.language,
						);
						const t = (key: string, vars?: Record<string, any>) =>
							client.i18n.translate(currentGuild.lang, key, vars);

						const embed = new EmbedBuilder()
							.setTitle(
								t('translation.embed.title', {
									lang: currentGuild.lang!.toUpperCase(),
									flag: langCodeToFlagEmoji(currentGuild.lang!),
								}),
							)
							.setDescription(`\`\`\`${translatedText}\`\`\``)
							.setColor('#46d8ef')
							.setFooter({
								text: t('translation.embed.footer', {
									flag: langCodeToFlagEmoji(detectedLanguage.language),
									sourceLang: detectedLanguage.language.toUpperCase(),
									confidence: detectedLanguage.confidence,
								}),
							});

						await message.reply({ embeds: [embed] });
						client.logger.debug(
							`Auto-translated message ${message.id} from ${detectedLanguage.language} to ${currentGuild.lang} in guild ${message.guildId}`,
						);
					}
				}
			} catch (error) {
				client.logger.error(`Failed to process ${this.name} for message ${message.id}: ${error}`);
			}
		}
	}
}
