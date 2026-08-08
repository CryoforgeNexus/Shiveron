import {
	EmbedBuilder,
	Message,
	ChatInputCommandInteraction,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	MessageComponentInteraction,
} from 'discord.js';
import type { ShiveronClient } from '../../core/ShiveronClient.js';

/**
 * Sends the first page of a paginated embed list as a reply to a slash command interaction, and attaches navigation buttons and a collector to handle page changes.
 * @param client - The bot client, used for error logging in the pagination collector.
 * @param interaction - The slash command interaction to reply to.
 * @param pages - An array of EmbedBuilders, one per page.
 * @param timeout - How long (in ms) the pagination buttons remain active before being disabled.
 */
export async function paginateFromInteraction(
	client: ShiveronClient,
	interaction: ChatInputCommandInteraction,
	pages: EmbedBuilder[],
	timeout: number,
): Promise<void> {
	const buttons = createButtonsPagination(pages.length);
	const message = (await interaction.editReply({
		embeds: [pages[0]!],
		components: [buttons],
	})) as Message;

	setupPaginationCollector(client, message, interaction.user.id, pages, timeout, buttons);
}

/**
 * Creates an ActionRow containing five pagination buttons: first, previous, page counter, next, last. Navigation buttons are disabled when there is only one page.
 * @param pagesAmount - The total number of pages, used to disable next/last on single-page results.
 */
function createButtonsPagination(pagesAmount: number): ActionRowBuilder<ButtonBuilder> {
	const pageFirst = new ButtonBuilder()
		.setCustomId('pagefirst')
		.setEmoji('⏮')
		.setStyle(ButtonStyle.Primary)
		.setDisabled(true);

	const pagePrev = new ButtonBuilder()
		.setCustomId('pageprev')
		.setEmoji('◀️')
		.setStyle(ButtonStyle.Primary)
		.setDisabled(true);

	const pageCount = new ButtonBuilder()
		.setCustomId('pagecount')
		.setLabel('1/1')
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(true);

	const pageNext = new ButtonBuilder().setCustomId('pagenext').setEmoji('▶️').setStyle(ButtonStyle.Primary);

	const pageLast = new ButtonBuilder().setCustomId('pagelast').setEmoji('⏭').setStyle(ButtonStyle.Primary);

	if (pagesAmount == 1) {
		pageNext.setDisabled(true);
		pageLast.setDisabled(true);
	}

	return new ActionRowBuilder<ButtonBuilder>().addComponents([pageFirst, pagePrev, pageCount, pageNext, pageLast]);
}

/**
 * Updates the enabled/disabled state and label of pagination buttons based on the current page.
 * @param buttons - The ActionRow containing the pagination buttons to update.
 * @param currentPage - The zero-based index of the currently displayed page.
 * @param totalPages - The total number of pages.
 */
function updateButtonsPagination(
	buttons: ActionRowBuilder<ButtonBuilder>,
	currentPage: number,
	totalPages: number,
): void {
	const [pageFirst, pagePrev, pageCount, pageNext, pageLast] = buttons.components;

	pageFirst!.setDisabled(currentPage === 0);
	pagePrev!.setDisabled(currentPage === 0);
	pageNext!.setDisabled(currentPage === totalPages - 1);
	pageLast!.setDisabled(currentPage === totalPages - 1);
	pageCount!.setLabel(`${currentPage + 1}/${totalPages}`);
}

/**
 * Disables all non-secondary (i.e., non-counter) pagination buttons, typically called when the collector times out.
 * @param buttons - The ActionRow containing the pagination buttons to disable.
 */
function disableButtonsPagination(buttons: ActionRowBuilder<ButtonBuilder>): void {
	buttons.components.forEach((button) => {
		if (button.data.style !== ButtonStyle.Secondary) {
			button.setDisabled(true);
		}
	});
}

/**
 * Attaches a message component collector to a paginated message. Handles button clicks to navigate between pages, restricts use to the original command author, and disables buttons after the timeout expires.
 * @param client - The bot client, used for error logging.
 * @param message - The message the buttons are attached to.
 * @param ownerId - The Discord user ID of the person allowed to use the pagination buttons.
 * @param pages - The array of EmbedBuilders representing each page.
 * @param timeout - How long (in ms) before the collector expires and buttons are disabled.
 * @param buttons - The ActionRow of pagination buttons to update on each interaction.
 */
function setupPaginationCollector(
	client: ShiveronClient,
	message: Message,
	ownerId: string,
	pages: EmbedBuilder[],
	timeout: number,
	buttons: ActionRowBuilder<ButtonBuilder>,
): void {
	let currentPage = 0;

	if (pages.length == 1) {
		return;
	}

	const collector = message.createMessageComponentCollector({
		componentType: ComponentType.Button,
		time: timeout,
	});

	collector.on('end', async () => {
		try {
			disableButtonsPagination(buttons);

			message.edit({
				content:
					'The buttons have been disabled because more than 60 seconds have passed since the last interaction',
				embeds: [pages[currentPage]!.data],
				components: [buttons],
			});
		} catch (error) {
			client.logger.error(`Failed to cleanup pagination : ${error}`);
		}
	});

	collector.on('collect', async (interaction: MessageComponentInteraction) => {
		try {
			if (interaction.user.id !== ownerId) {
				interaction.reply({
					content: 'You are not allowed to use these buttons',
					ephemeral: true,
				});
				return;
			}

			await interaction.deferUpdate();

			switch (interaction.customId) {
				case 'pagefirst':
					currentPage = 0;
					break;
				case 'pageprev':
					currentPage = Math.max(0, currentPage - 1);
					break;
				case 'pagenext':
					currentPage = Math.min(pages.length - 1, currentPage + 1);
					break;
				case 'pagelast':
					currentPage = pages.length - 1;
					break;
			}

			updateButtonsPagination(buttons, currentPage, pages.length);

			interaction.editReply({
				embeds: [pages[currentPage]!],
				components: [buttons],
			});

			collector.resetTimer();
		} catch (error) {
			client.logger.error(`Failed to handle pagination interaction : ${error}`);
		}
	});
}
