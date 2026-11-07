import { EmbedBuilder, type User } from 'discord.js';
import type { Translator } from '../../core/I18N.js';
import { DISCORD_EMBED_DESCRIPTION_MAX_LENGTH } from '../constants.js';
import { langCodeToFlagEmoji } from '../flagLanguageMap.js';

/** What a translation embed shows. */
export interface TranslationEmbedOptions {
	translatedText: string;
	targetLanguage: string;
	/** Language translated from, shown in the footer; omitted when unknown. */
	sourceLanguage: string | null;
	/** Person who asked for the translation, shown as the author. */
	requester?: User;
	/** Link to the original message, set as the title link so a translation read out of context (in a DM) can be traced back. */
	messageUrl?: string;
}

/**
 * Builds the embed every translation is shown in: automatic, flag reaction, and `/translate`.
 *
 * The text is plain description, not a code block, so restored mentions, channels and emoji render (embeds never ping). It is cut to Discord's description limit, since a translation can run longer than its source.
 * @param t - Translation function bound to the locale the embed is shown in.
 * @param options - The translation and its context.
 * @returns The embed, ready to send.
 */
export function buildTranslationEmbed(t: Translator, options: TranslationEmbedOptions): EmbedBuilder {
	const text =
		options.translatedText.length > DISCORD_EMBED_DESCRIPTION_MAX_LENGTH
			? `${options.translatedText.slice(0, DISCORD_EMBED_DESCRIPTION_MAX_LENGTH - 1)}…`
			: options.translatedText;

	const embed = new EmbedBuilder()
		.setTitle(
			t('translation.embed.title', {
				lang: options.targetLanguage.toUpperCase(),
				flag: langCodeToFlagEmoji(options.targetLanguage),
			}),
		)
		.setDescription(text)
		.setColor('#46d8ef');

	if (options.requester) {
		embed.setAuthor({ name: options.requester.displayName, iconURL: options.requester.displayAvatarURL() });
	}

	if (options.messageUrl) {
		embed.setURL(options.messageUrl);
	}

	if (options.sourceLanguage) {
		embed.setFooter({
			text: t('translation.embed.footer', {
				flag: langCodeToFlagEmoji(options.sourceLanguage),
				sourceLang: options.sourceLanguage.toUpperCase(),
			}),
		});
	}

	return embed;
}
