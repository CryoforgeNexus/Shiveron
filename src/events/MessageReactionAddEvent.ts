import {
	type EmbedBuilder,
	type Message,
	type MessageReaction,
	type MessageReactionEventDetails,
	type PartialMessageReaction,
	type PartialUser,
	type User,
} from 'discord.js';
import { BaseEvent } from '../core/BaseEvent.js';
import type { ShiveronClient } from '../core/ShiveronClient.js';
import type { Translator } from '../core/I18N.js';
import { flagEmojiToLangCode } from '../utils/flagLanguageMap.js';
import { FLAG_TRANSLATION_FALLBACK_TTL_MS } from '../utils/constants.js';
import { buildTranslationEmbed } from '../utils/discord/translationEmbed.js';
import { hasTranslatableText, stripProtectedSpans } from '../utils/translationText.js';

/** Fires when a user adds a reaction. Translates the reacted message when the emoji is a flag. */
export default class MessageReactionAddEvent extends BaseEvent<'messageReactionAdd'> {
	public readonly name = 'messageReactionAdd';
	public once = false;

	/**
	 * Checks whether the added reaction is a flag emoji. If so, translates the reacted message into the flag's language and sends the result privately to the user who reacted.
	 *
	 * Reactions cannot answer ephemerally, so the translation is sent by DM. When the user's DMs are closed, it is posted in the channel, mentioning them, and deleted after `FLAG_TRANSLATION_FALLBACK_TTL_MS`. Reactions on messages sent before the bot started arrive as partials and are fetched first.
	 * @param client - The bot client instance.
	 * @param reaction - The reaction that was added, possibly partial.
	 * @param user - The user who added the reaction, possibly partial.
	 */
	public override async execute(
		client: ShiveronClient,
		reaction: MessageReaction | PartialMessageReaction,
		user: User | PartialUser,
		_details: MessageReactionEventDetails,
	): Promise<void> {
		const emojiName = reaction.emoji.name;
		const flagLanguage = emojiName ? flagEmojiToLangCode(emojiName) : null;
		if (!flagLanguage) {
			return;
		}

		try {
			const fullUser = user.partial ? await user.fetch() : user;
			if (fullUser.bot) {
				return;
			}

			const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
			if (!message.guildId || !hasTranslatableText(stripProtectedSpans(message.content))) {
				return;
			}

			const currentGuild = await client.guildSettingsService.createOrGetGuildSettings(message.guildId);
			const t = client.i18n.getTranslator(currentGuild.lang);

			const targetLanguage = await client.libreTranslate.resolveLanguage(flagLanguage);
			if (!targetLanguage) {
				await this.deliver(client, message, fullUser, t, {
					content: t('translation.unsupported_language', { lang: flagLanguage.toUpperCase() }),
				});
				return;
			}

			const { translatedText, sourceLanguage } = await client.libreTranslate.translate(
				message.content,
				targetLanguage,
			);
			if (sourceLanguage === targetLanguage) {
				return;
			}

			const embed = buildTranslationEmbed(t, {
				translatedText,
				targetLanguage,
				sourceLanguage,
				requester: fullUser,
				messageUrl: message.url,
			});

			await this.deliver(client, message, fullUser, t, { embeds: [embed] });
			client.logger.debug(`Flag-translated message ${message.id} to ${targetLanguage} for user ${fullUser.id}`);
		} catch (error) {
			client.logger.error(`Failed to process ${this.name} for emoji ${emojiName}: ${error}`);
		}
	}

	/**
	 * Sends a flag-reaction answer to the reactor by DM, or, when their DMs are closed, as a channel reply that mentions only them and deletes itself.
	 * @param client - The bot client instance.
	 * @param message - The reacted message, replied to in the fallback.
	 * @param user - The user who reacted.
	 * @param t - Translation function bound to the guild's locale, for the fallback notice.
	 * @param payload - The text or embeds to deliver.
	 */
	private async deliver(
		client: ShiveronClient,
		message: Message,
		user: User,
		t: Translator,
		payload: { content?: string; embeds?: EmbedBuilder[] },
	): Promise<void> {
		try {
			await user.send(payload);
			return;
		} catch {
			client.logger.debug(`DMs closed for user ${user.id}; posting the flag translation in the channel.`);
		}

		const notice = t('translation.dm_fallback', {
			user: user.toString(),
			seconds: FLAG_TRANSLATION_FALLBACK_TTL_MS / 1000,
		});

		const reply = await message.reply({
			content: payload.content ? `${notice}\n${payload.content}` : notice,
			embeds: payload.embeds ?? [],
			allowedMentions: { users: [user.id], repliedUser: false },
		});

		setTimeout(() => {
			reply
				.delete()
				.catch((error) => client.logger.warn(`Could not delete flag translation ${reply.id}: ${error}`));
		}, FLAG_TRANSLATION_FALLBACK_TTL_MS);
	}
}
