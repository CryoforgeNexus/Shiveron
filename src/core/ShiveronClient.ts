import { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType, Partials } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { BaseCommand } from './BaseCommand.js';
import { BaseEvent } from './BaseEvent.js';
import { Database } from './Database.js';
import { ShiveronLogger } from './ShiveronLogger.js';
import { GuildSettingsService } from '../services/GuildSettingsService.js';
import { VoiceService } from '../services/VoiceService.js';
import { InfractionService } from '../services/InfractionService.js';
import { getConfig } from '../utils/config.js';
import { BOT_PRESENCE_TEXT, INFRACTION_EXPIRY_CHECK_INTERVAL_MS } from '../utils/constants.js';
import { CollectorManager } from '../events/voice/CollectorManager.js';
import { I18N } from './I18N.js';
import { LibreTranslateService } from '../services/LibreTranslateService.js';

/** The main Discord bot client. Extends discord.js Client with command/event loading, service access, and i18n support. */
export class ShiveronClient extends Client {
	public commands: Collection<string, BaseCommand>;
	public logger: ShiveronLogger;
	private db: Database;
	public collectorManager: CollectorManager;
	public guildSettingsService: GuildSettingsService;
	public infractionService: InfractionService;
	public voiceService: VoiceService;
	public i18n: I18N;
	public libreTranslate: LibreTranslateService;

	/** Initializes the Discord client with required gateway intents and sets up all services and managers. */
	public constructor() {
		super({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildVoiceStates,
				GatewayIntentBits.GuildMembers,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.MessageContent,
				GatewayIntentBits.GuildMessageReactions,
			],
			// Without these, reactions on messages sent before the bot started never fire messageReactionAdd. Handlers that opt in fetch the partial before use.
			partials: [Partials.Message, Partials.Reaction, Partials.User],
		});

		this.commands = new Collection();
		this.logger = new ShiveronLogger();
		this.db = new Database(this.logger);
		this.collectorManager = new CollectorManager();
		this.guildSettingsService = new GuildSettingsService(this.logger);
		this.infractionService = new InfractionService(this.logger);
		this.voiceService = new VoiceService(this.logger);
		this.i18n = new I18N();
		this.libreTranslate = new LibreTranslateService(this.logger);
	}

	/**
	 * Boots the bot: connects to the database, loads locales, registers commands and events, logs in to Discord, starts the infraction expiry check interval, and sets the bot's presence.
	 */
	public async start(): Promise<void> {
		await this.db.connect();
		this.i18n.loadLocales();
		await this.loadCommands();
		await this.loadEvents();
		await this.registerSlashCommands();
		await this.login(getConfig('DISCORD_TOKEN'));
		setInterval(
			async () => this.infractionService.checkExpiredInfractions(this),
			INFRACTION_EXPIRY_CHECK_INTERVAL_MS,
		);
		this.user!.setPresence({
			activities: [
				{
					name: BOT_PRESENCE_TEXT,
					type: ActivityType.Watching,
				},
			],
			status: 'online',
		});
	}

	/**
	 * Dynamically imports all command files from `dist/commands` subdirectories and registers each one that has a valid default export with a `data` property.
	 */
	private async loadCommands(): Promise<void> {
		const foldersPath = path.join(process.cwd(), 'dist/commands');
		if (!fs.existsSync(foldersPath)) {
			this.logger.warn(`Commands folder not found at ${foldersPath}`);
			return;
		}

		const commandFolder = fs.readdirSync(foldersPath);
		for (const folder of commandFolder) {
			const commandsPath = path.join(foldersPath, folder);
			const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

			for (const file of commandFiles) {
				try {
					const fullPath = path.join(commandsPath, file);
					const module = await import(pathToFileURL(fullPath).href);

					const CommandClass = module?.default;
					if (!CommandClass) {
						this.logger.warn(`Command file ${file} has no default export.`);
						continue;
					}

					const commandInstance: BaseCommand = new CommandClass();
					if (!commandInstance.data) {
						this.logger.warn(`Command ${file} has no data property. Skipping.`);
						continue;
					}

					this.registerCommand(commandInstance);
					this.logger.debug(`Loaded command: ${commandInstance.data.name}.`);
				} catch (error) {
					this.logger.error(`Failed to load command ${file} : ${error}`);
				}
			}
		}
		this.logger.info(`Loaded ${this.commands.size} command(s).`);
	}

	/**
	 * Dynamically imports all event files from `dist/events` and registers each one that has a valid default export with a `name` property.
	 */
	private async loadEvents(): Promise<void> {
		const eventsPath = path.join(process.cwd(), 'dist/events');
		if (!fs.existsSync(eventsPath)) {
			this.logger.warn(`Events folder not found at ${eventsPath}`);
			return;
		}

		const eventFiles = fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'));
		let loadedCount = 0;

		for (const file of eventFiles) {
			try {
				const fullPath = path.join(eventsPath, file);
				const module = await import(pathToFileURL(fullPath).href);
				const EventClass = module?.default;

				if (!EventClass) {
					this.logger.warn(`Event file ${file} has no default export.`);
					continue;
				}

				const eventInstance: BaseEvent<any> = new EventClass();

				if (!('name' in eventInstance)) {
					this.logger.warn(`Event ${file} has no name property. Skipping.`);
					continue;
				}

				this.registerEvent(eventInstance);
				this.logger.debug(`Loaded event: ${eventInstance.name}.`);
				loadedCount++;
			} catch (error) {
				this.logger.error(`Failed to load event ${file} : ${error}`);
			}
		}

		this.logger.info(`Loaded ${loadedCount} event(s).`);
	}

	/**
	 * Deploys all loaded slash commands to Discord via the REST API. Deploys to a specific guild in development mode, or globally otherwise.
	 */
	private async registerSlashCommands(): Promise<void> {
		const rest = new REST({ version: '10' }).setToken(getConfig('DISCORD_TOKEN')!);
		const commandsArray = Array.from(this.commands.values()).map((cmd) => cmd.data.toJSON());

		if (getConfig('NODE_ENV') === 'development') {
			if (!getConfig('DISCORD_GUILD_ID')) {
				this.logger.warn('DISCORD_GUILD_ID is not set. Skipping guild command registration.');
				return;
			}
			await rest.put(
				Routes.applicationGuildCommands(getConfig('DISCORD_CLIENT_ID')!, getConfig('DISCORD_GUILD_ID')!),
				{ body: commandsArray },
			);
			this.logger.info(`Deployed ${commandsArray.length} commands to guild ${getConfig('DISCORD_GUILD_ID')}.`);
		} else {
			await rest.put(Routes.applicationCommands(getConfig('DISCORD_CLIENT_ID')!), { body: commandsArray });
			this.logger.info(`Deployed ${commandsArray.length} commands globally.`);
		}
	}

	/**
	 * Adds a command to the client's command collection, keyed by its name.
	 * @param command - The command instance to register.
	 */
	public registerCommand(command: BaseCommand) {
		this.commands.set(command.data.name, command);
	}

	/**
	 * Binds a Discord gateway event to its handler. Uses `once` for one-time events, `on` for recurring ones.
	 * @param event - The event instance to register.
	 */
	public registerEvent(event: BaseEvent<any>): void {
		if (event.once) {
			this.once(event.name, (...args) => event.execute(this, ...args));
		} else {
			this.on(event.name, (...args) => event.execute(this, ...args));
		}
	}
}
