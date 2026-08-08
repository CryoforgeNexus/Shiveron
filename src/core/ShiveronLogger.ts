import path from 'path';
import fs from 'fs';

export enum LogLevel {
	INFO = 'info',
	WARN = 'warn',
	ERROR = 'error',
	DEBUG = 'debug',
}

/** Logger that writes formatted messages to the console and to log files under `logs/`. */
export class ShiveronLogger {
	private logDir = path.join(process.cwd(), 'logs');
	private standardLog = path.join(this.logDir, 'standard.log');
	private debugLog = path.join(this.logDir, 'debug.log');

	/** Creates the `logs/` directory if it does not already exist. */
	public constructor() {
		if (!fs.existsSync(this.logDir)) {
			fs.mkdirSync(this.logDir, { recursive: true });
		}
	}

	/**
	 * Pads a number to at least 2 digits with a leading zero.
	 * @param num - The number to pad.
	 */
	private pad(num: number): string {
		return num.toString().padStart(2, '0');
	}

	/** Returns the current date and time formatted as `[DD/MM/YYYY HH:MM:SS]`. */
	private getCurrentTimestampFormatted(): string {
		const currentDate = new Date();
		const day = this.pad(currentDate.getDate());
		const month = this.pad(currentDate.getMonth() + 1);
		const year = currentDate.getFullYear();
		const hours = this.pad(currentDate.getHours());
		const minutes = this.pad(currentDate.getMinutes());
		const seconds = this.pad(currentDate.getSeconds());

		return `[${day}/${month}/${year} ${hours}:${minutes}:${seconds}]`;
	}

	/**
	 * Builds a complete log line with a timestamp prefix and level tag.
	 * @param level - The log level (INFO, WARN, ERROR, DEBUG).
	 * @param message - The message content to include.
	 */
	private formatMessage(level: LogLevel, message: string): string {
		return `${this.getCurrentTimestampFormatted()} [${level}] ${message}`;
	}

	/**
	 * Appends a formatted message to the appropriate log file(s). DEBUG messages are only written to `debug.log`; all others go to both `standard.log` and `debug.log`.
	 * @param level - The log level used to decide which files to write to.
	 * @param formattedMessage - The already-formatted log line to write.
	 */
	private async writeToFile(level: LogLevel, formattedMessage: string) {
		if (level != LogLevel.DEBUG) {
			fs.appendFile(this.standardLog, formattedMessage + '\n', (error) => {
				if (error) {
					console.error('Log Error (standard.log):', error);
				}
			});
		}
		fs.appendFile(this.debugLog, formattedMessage + '\n', (error) => {
			if (error) {
				console.error('Log Error (debug.log):', error);
			}
		});
	}

	/**
	 * Logs an informational message to the console and log files.
	 * @param message - The message to log.
	 */
	public info(message: string): void {
		const formatted = this.formatMessage(LogLevel.INFO, message);
		console.info(formatted);
		this.writeToFile(LogLevel.INFO, formatted);
	}

	/**
	 * Logs a warning message to the console and log files.
	 * @param message - The message to log.
	 */
	public warn(message: string): void {
		const formatted = this.formatMessage(LogLevel.WARN, message);
		console.warn(formatted);
		this.writeToFile(LogLevel.WARN, formatted);
	}

	/**
	 * Logs an error message to the console and log files.
	 * @param message - The message to log.
	 */
	public error(message: string): void {
		const formatted = this.formatMessage(LogLevel.ERROR, message);
		console.error(formatted);
		this.writeToFile(LogLevel.ERROR, formatted);
	}

	/**
	 * Logs a debug message to the console and the debug log file only.
	 * @param message - The message to log.
	 */
	public debug(message: string): void {
		const formatted = this.formatMessage(LogLevel.DEBUG, message);
		console.debug(formatted);
		this.writeToFile(LogLevel.DEBUG, formatted);
	}
}
