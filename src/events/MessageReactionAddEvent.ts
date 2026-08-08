import { EmbedBuilder, type MessageReaction, type User, type MessageReactionEventDetails } from 'discord.js';
import { BaseEvent } from '../core/BaseEvent.js';
import type { ShiveronClient } from '../core/ShiveronClient.js';
import { flagEmojiToLangCode, langCodeToFlagEmoji } from '../utils/flagLanguageMap.js';
import { TRANSLATION_MIN_MESSAGE_LENGTH } from '../utils/constants.js';

/** Fires when a user adds a reaction. Translates the reacted message when the emoji is a flag. */
export default class MessageReactionAddEvent extends BaseEvent<'messageReactionAdd'> {
	public readonly name = 'messageReactionAdd';
	public once = false;

	/**
	 * Checks whether the added reaction is a flag emoji. If so, translates the reacted message into the flag's language and sends the result as a DM to the user who reacted (closest equivalent to an ephemeral reply for reactions).
	 * @param client - The bot client instance.
	 * @param reaction - The reaction that was added.
	 * @param user - The user who added the reaction.
	 */
	public override async execute(
		client: ShiveronClient,
		reaction: MessageReaction,
		user: User,
		_details: MessageReactionEventDetails,
	): Promise<void> {
		if (!user.bot) {
			const emojiName = reaction.emoji.name;

			if (emojiName) {
				const targetLang = flagEmojiToLangCode(emojiName);

				if (targetLang) {
					try {
						const message = reaction.message;

						if (
							message.content &&
							message.content.length >= TRANSLATION_MIN_MESSAGE_LENGTH &&
							message.guildId
						) {
							const currentGuild = await client.guildSettingsService.createOrGetGuildSettings(
								message.guildId,
							);
							const t = (key: string, vars?: Record<string, any>) =>
								client.i18n.translate(currentGuild.lang, key, vars);
							const { translatedText, detectedLanguage } = await client.libreTranslate.translate(
								message.content,
								targetLang,
							);

							if (detectedLanguage) {
								const sourceLang = detectedLanguage.language;
								const embed = new EmbedBuilder()
									.setAuthor({ name: user.displayName, iconURL: user.displayAvatarURL() })
									.setTitle(
										t('translation.embed.title', {
											lang: targetLang.toUpperCase(),
											flag: emojiName,
										}),
									)
									.setDescription(`\`\`\`${translatedText}\`\`\``)
									.setColor('#46d8ef')
									.setFooter({
										text: t('translation.embed.footer', {
											flag: langCodeToFlagEmoji(sourceLang),
											sourceLang: sourceLang.toUpperCase(),
											confidence: detectedLanguage.confidence,
										}),
									});

								message.reply({ embeds: [embed] });
								client.logger.debug(
									`Flag-translated message ${message.id} to ${targetLang} for user ${user.id}`,
								);
							}
						}
					} catch (error) {
						client.logger.error(`Failed to process ${this.name} for emoji ${emojiName}: ${error}`);
					}
				}
			}
		}
	}
}
