import {
	AutocompleteInteraction,
	ChatInputCommandInteraction,
	InteractionContextType,
	SlashCommandBuilder,
} from 'discord.js';
import { BaseCommand } from '../../core/BaseCommand.js';
import { ShiveronClient } from '../../core/ShiveronClient.js';
import { buildTranslationEmbed } from '../../utils/discord/translationEmbed.js';

export default class TranslateCommand extends BaseCommand {
	public data = new SlashCommandBuilder()
		.setName('translate')
		.setDescription('Translate a text to a given language.')
		.setDescriptionLocalizations({
			fr: 'Traduit un texte vers la langue choisie.',
			de: 'Übersetzt einen Text in eine bestimmte Sprache.',
		})
		.setContexts(InteractionContextType.Guild)
		.addStringOption((option) =>
			option
				.setName('text')
				.setDescription('The text to translate.')
				.setDescriptionLocalizations({
					fr: 'Le texte à traduire.',
					de: 'Der zu übersetzende Text.',
				})
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName('language')
				.setDescription('The target language.')
				.setDescriptionLocalizations({
					fr: 'La langue cible.',
					de: 'Die Zielsprache.',
				})
				.setRequired(true)
				.setAutocomplete(true),
		);

	public override async autocomplete(client: ShiveronClient, interaction: AutocompleteInteraction): Promise<void> {
		const focused = interaction.options.getFocused().toLowerCase();
		const languages = await client.libreTranslate.getLanguages();

		const choices = languages
			.filter((lang) => lang.name.toLowerCase().includes(focused) || lang.code.toLowerCase().includes(focused))
			.slice(0, 25)
			.map((lang) => ({ name: `${lang.name} (${lang.code})`, value: lang.code }));

		await interaction.respond(choices);
	}

	public async execute(
		client: ShiveronClient,
		interaction: ChatInputCommandInteraction,
		t: (path: string, vars?: Record<string, any>) => string,
	): Promise<void> {
		const text = interaction.options.getString('text', true);
		const targetLang = interaction.options.getString('language', true);

		await interaction.deferReply();

		const { translatedText, sourceLanguage } = await client.libreTranslate.translate(text, targetLang);

		const embed = buildTranslationEmbed(t, {
			translatedText,
			targetLanguage: targetLang,
			sourceLanguage,
			requester: interaction.user,
		});

		await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
	}
}
