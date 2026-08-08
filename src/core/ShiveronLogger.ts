export enum LogLevel {
	INFO = 'info',
	WARN = 'warn',
	ERROR = 'error',
	DEBUG = 'debug',
}

/**
 * Logger that writes formatted messages to the console.
 */
export class ShiveronLogger {
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
	 * Logs an informational message.
	 * @param message - The message to log.
	 */
	public info(message: string): void {
		console.info(this.formatMessage(LogLevel.INFO, message));
	}

	/**
	 * Logs a warning message.
	 * @param message - The message to log.
	 */
	public warn(message: string): void {
		console.warn(this.formatMessage(LogLevel.WARN, message));
	}

	/**
	 * Logs an error message.
	 * @param message - The message to log.
	 */
	public error(message: string): void {
		console.error(this.formatMessage(LogLevel.ERROR, message));
	}

	/**
	 * Logs a debug message.
	 * @param message - The message to log.
	 */
	public debug(message: string): void {
		console.debug(this.formatMessage(LogLevel.DEBUG, message));
	}
}
