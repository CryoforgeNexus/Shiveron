import fs from 'fs';
import path from 'path';
import { interpolate } from '../utils/formatters.js';

/**
 * A locale-bound translation function. Callers that already know which guild they are serving close over the locale once and pass this around instead of threading the locale everywhere.
 */
export type Translator = (path: string, vars?: Record<string, any>) => string;

/** Handles loading and resolving localization strings from JSON locale files. */
export class I18N {
	private translations: Map<string, any>;

	/** Initializes an empty translations map. */
	public constructor() {
		this.translations = new Map();
	}

	/**
	 * Reads all `.json` files from the `dist/locales` directory and loads them into the translations map, keyed by their filename (e.g., `en`, `fr`).
	 */
	public loadLocales() {
		const localesPath = path.join(process.cwd(), 'dist/locales');

		if (!fs.existsSync(localesPath)) {
			throw new Error(`Locales folder not found at ${localesPath}`);
		}
		const files = fs.readdirSync(localesPath);

		for (const file of files) {
			if (file.endsWith('.json')) {
				const locale = path.parse(file).name;
				const content = fs.readFileSync(path.join(localesPath, file), 'utf-8');
				this.translations.set(locale, JSON.parse(content));
			}
		}
	}

	/**
	 * Traverses a nested object using a dot-separated path string and returns the value at that path.
	 * @param bundle - The root translation object to traverse.
	 * @param keyPath - A dot-separated key path (e.g., `"command.ban.success"`).
	 * @returns The string value at the given path, or `null` if not found.
	 */
	private getNestedValue(bundle: any, keyPath: string): string | null {
		const keys = keyPath.split('.');
		let value = bundle;

		for (const key of keys) {
			if (value == null || value == undefined) {
				return null;
			}
			value = value[key];
		}
		return typeof value == 'string' ? value : null;
	}

	/**
	 * Resolves a translation key for the given locale, falling back to `en` if the locale is not loaded. Interpolates any provided variables into the template string.
	 * @param locale - The locale code to look up (e.g., `"fr"`).
	 * @param keyPath - A dot-separated key path into the locale bundle.
	 * @param vars - Optional key-value pairs to interpolate into the template (e.g., `{ user: "Alice" }`).
	 * @returns The interpolated translation string, or the raw path if the key is not found.
	 */
	public translate(locale: string, keyPath: string, vars: Record<string, any> = {}): string {
		const lang = this.translations.has(locale) ? locale : 'en';
		const bundle = this.translations.get(lang);
		const template = this.getNestedValue(bundle, keyPath);

		if (template == null) {
			return keyPath;
		}
		return interpolate(template, vars);
	}
}
