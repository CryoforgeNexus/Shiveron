import { type MessageReaction, type User, type MessageReactionEventDetails } from 'discord.js';
import { BaseEvent } from '../core/BaseEvent.js';
import type { ShiveronClient } from '../core/ShiveronClient.js';
import { flagEmojiToLangCode } from '../utils/flagLanguageMap.js';
import { TRANSLATION_MIN_MESSAGE_LENGTH } from '../utils/constants.js';
import { buildTranslationEmbed } from '../utils/discord/translationEmbed.js';

/** Fires when a user adds a reaction. Translates the reacted message when the emoji is a flag. */
export default class MessageReactionAddEvent extends BaseEvent<'messageReactionAdd'> {
	public readonly name = 'messageReactionAdd';
	public once = false;

	/**
	 * Checks whether the added reaction is a flag emoji. If so, translates the reacted message into the flag's language and replies with the result.
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
							const { translatedText, sourceLanguage } = await client.libreTranslate.translate(
								message.content,
								targetLang,
							);

							const embed = buildTranslationEmbed(client.i18n.getTranslator(currentGuild.lang), {
								translatedText,
								targetLanguage: targetLang,
								sourceLanguage,
								requester: user,
							});

							await message.reply({ embeds: [embed] });
							client.logger.debug(
								`Flag-translated message ${message.id} to ${targetLang} for user ${user.id}`,
							);
						}
					} catch (error) {
						client.logger.error(`Failed to process ${this.name} for emoji ${emojiName}: ${error}`);
					}
				}
			}
		}
	}
}
