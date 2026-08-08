import { BaseEvent } from '../core/BaseEvent.js';
import { ShiveronClient } from '../core/ShiveronClient.js';

/** Fires once when the bot successfully connects to Discord and is ready to receive events. */
export default class ClientReadyEvent extends BaseEvent<'clientReady'> {
	public readonly name = 'clientReady';
	public once = true;

	/**
	 * Logs the bot's tag to confirm a successful login, then probes LibreTranslate. An unreachable translation backend is not fatal: the rest of the bot works, and only the translation features fail, so this is surfaced as a warning at boot rather than as an error per message.
	 * @param client - The bot client instance, used to access `client.user.tag`.
	 */
	public async execute(client: ShiveronClient): Promise<void> {
		client.logger.info(`Logged in as ${client.user?.tag}.`);

		if (await client.libreTranslate.isAvailable()) {
			client.logger.info('LibreTranslate is reachable.');
		} else {
			client.logger.warn('LibreTranslate is unreachable. Translation features will fail until it recovers.');
		}
	}
}
