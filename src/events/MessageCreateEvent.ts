import { type OmitPartialGroupDMChannel, type Message } from 'discord.js';
import { BaseEvent } from '../core/BaseEvent.js';
import { ShiveronClient } from '../core/ShiveronClient.js';
import { TRANSLATION_MIN_MESSAGE_LENGTH } from '../utils/constants.js';
import { buildTranslationEmbed } from '../utils/discord/translationEmbed.js';

/** Fires on every new message. Auto-translates to the guild language when a different language is detected. */
export default class MessageCreateEvent extends BaseEvent<'messageCreate'> {
	public readonly name = 'messageCreate';
	public once = false;

	/**
	 * Checks the language of every non-bot guild message outside the blacklisted channels, users and roles. If the message is confidently in another language than the guild's, replies with a translation embed. Detection is local, so LibreTranslate is only called for messages that will be translated.
	 * @param client - The bot client instance.
	 * @param message - The newly created message.
	 */
	public async execute(client: ShiveronClient, message: OmitPartialGroupDMChannel<Message>): Promise<void> {
		if (message.author.bot || message.webhookId || !message.guildId) {
			return;
		}
		// Cheap precheck on the raw text; the service measures the length again without mentions, links and emoji.
		if (message.content.length < TRANSLATION_MIN_MESSAGE_LENGTH) {
			return;
		}

		try {
			const currentGuild = await client.guildSettingsService.createOrGetGuildSettings(message.guildId);
			if (!currentGuild.autoTranslate || !currentGuild.lang) {
				return;
			}

			const blacklistedRoles = currentGuild.autoTranslateRoleBlacklist ?? [];
			const isBlacklisted =
				currentGuild.autoTranslateBlacklist?.includes(message.channelId) ||
				currentGuild.autoTranslateUserBlacklist?.includes(message.author.id) ||
				message.member?.roles.cache.hasAny(...blacklistedRoles);
			if (isBlacklisted) {
				return;
			}

			const detection = client.libreTranslate.detectForeignLanguage(message.content, currentGuild.lang);
			if (!detection) {
				return;
			}

			const { translatedText, sourceLanguage } = await client.libreTranslate.translate(
				message.content,
				currentGuild.lang,
				detection.reliable ? detection.language : undefined,
			);
			if (sourceLanguage === currentGuild.lang) {
				return;
			}

			const embed = buildTranslationEmbed(client.i18n.getTranslator(currentGuild.lang), {
				translatedText,
				targetLanguage: currentGuild.lang,
				sourceLanguage,
			});

			await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
			client.logger.debug(
				`Auto-translated message ${message.id} from ${sourceLanguage} to ${currentGuild.lang} in guild ${message.guildId}`,
			);
		} catch (error) {
			client.logger.error(`Failed to process ${this.name} for message ${message.id}: ${error}`);
		}
	}
}
