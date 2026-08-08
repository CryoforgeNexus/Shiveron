import { ShiveronLogger } from '../core/ShiveronLogger.js';
import { getConfig } from '../utils/config.js';
import { TRANSLATION_CACHE_MAX_ENTRIES } from '../utils/constants.js';

/**
 * A bounded least-recently-used cache.
 *
 * Backed by a `Map`, which iterates in insertion order: re-inserting a key on read moves it to the back, so the first key returned by the iterator is always the least recently used one. Kept module-private because the translation service is its only caller.
 */
class LRUCache<T> {
	private readonly entries = new Map<string, T>();
	private readonly maxEntries: number;

	/**
	 * @param maxEntries - Number of entries held before the least recently used one is evicted.
	 */
	public constructor(maxEntries: number) {
		this.maxEntries = maxEntries;
	}

	/**
	 * Looks up a key and marks it as most recently used on a hit.
	 * @param key - The cache key.
	 * @returns The cached value, or `undefined` if the key is absent.
	 */
	public get(key: string): T | undefined {
		const value = this.entries.get(key);
		if (value === undefined) {
			return undefined;
		}

		this.entries.delete(key);
		this.entries.set(key, value);
		return value;
	}

	/**
	 * Stores a value, evicting the least recently used entry once the cache is full.
	 * @param key - The cache key.
	 * @param value - The value to store.
	 */
	public set(key: string, value: T): void {
		this.entries.delete(key);
		this.entries.set(key, value);

		if (this.entries.size > this.maxEntries) {
			const oldest = this.entries.keys().next();
			if (!oldest.done) {
				this.entries.delete(oldest.value);
			}
		}
	}
}

/**
 * Wraps the LibreTranslate HTTP API.
 *
 * Supports:
 * - Single-string translation with optional auto-detection of the source language
 * - Language detection with confidence scores (used to skip low-confidence detections)
 * - Full locale bundle translation for the I18N system
 * - Listing all languages supported by the running instance
 * - Health check to detect when the service is unavailable
 *
 * Translation and detection results are cached in memory.
 */
export class LibreTranslateService {
	private readonly baseUrl: string;
	private readonly logger: ShiveronLogger;
	private readonly translationCache = new LRUCache<{
		translatedText: string;
		detectedLanguage: { language: string; confidence: number } | null;
	}>(TRANSLATION_CACHE_MAX_ENTRIES);
	private readonly detectionCache = new LRUCache<{ language: string; confidence: number }[]>(
		TRANSLATION_CACHE_MAX_ENTRIES,
	);

	public constructor(logger: ShiveronLogger) {
		this.logger = logger;
		this.baseUrl = getConfig('LIBRETRANSLATE_URL');
	}

	/**
	 * Translates a string into the target language.
	 *
	 * Pass `sourceLang = "auto"` (the default) to let LibreTranslate detect the source language automatically. The detection result is then included in the returned object so callers can show it alongside the translation or use the confidence score to decide whether to surface the result.
	 *
	 * @param text - The text to translate.
	 * @param targetLang - BCP 47 code of the desired output language (e.g. `"es"`).
	 * @param sourceLang - BCP 47 code of the input language, or `"auto"` to detect.
	 * @returns `translatedText` plus `detectedLanguage` (language code + confidence 0–100) when source was auto-detected, or `null` when source was explicit.
	 */
	public async translate(
		text: string,
		targetLang: string,
		sourceLang = 'auto',
	): Promise<{ translatedText: string; detectedLanguage: { language: string; confidence: number } | null }> {
		const cacheKey = `${sourceLang}:${targetLang}:${text}`;
		const cached = this.translationCache.get(cacheKey);
		if (cached) {
			this.logger.debug(`LibreTranslate /translate cache hit for ${sourceLang} to ${targetLang}.`);
			return cached;
		}

		const startedAt = Date.now();
		const response = await fetch(`${this.baseUrl}/translate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ q: text, source: sourceLang, target: targetLang, format: 'text' }),
		});

		if (!response.ok) {
			const message = `LibreTranslate /translate error ${response.status}: ${await response.text()}`;
			this.logger.error(message);
			throw new Error(message);
		}

		const data = (await response.json()) as {
			translatedText: string;
			detectedLanguage?: { language: string; confidence: number };
		};

		const result = {
			translatedText: data.translatedText,
			detectedLanguage: data.detectedLanguage ?? null,
		};

		this.translationCache.set(cacheKey, result);
		this.logger.debug(
			`LibreTranslate /translate took ${Date.now() - startedAt}ms for ${sourceLang} to ${targetLang}.`,
		);
		return result;
	}

	/**
	 * Detects the language(s) of a text and returns them sorted by descending confidence. Use the `confidence` field (0–100) to decide whether to act on the result.
	 *
	 * @param text - The text whose language should be identified.
	 */
	public async detect(text: string): Promise<{ language: string; confidence: number }[]> {
		const cached = this.detectionCache.get(text);
		if (cached) {
			return cached;
		}

		const startedAt = Date.now();
		const response = await fetch(`${this.baseUrl}/detect`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ q: text }),
		});

		if (!response.ok) {
			const message = `LibreTranslate /detect error ${response.status}: ${await response.text()}`;
			this.logger.error(message);
			throw new Error(message);
		}

		const data = (await response.json()) as { language: string; confidence: number }[];
		const sorted = data.sort((a, b) => b.confidence - a.confidence);

		this.detectionCache.set(text, sorted);
		this.logger.debug(`LibreTranslate /detect took ${Date.now() - startedAt}ms.`);
		return sorted;
	}

	/**
	 * Returns the list of languages supported by this LibreTranslate instance. Useful for populating the language picker in the setup command.
	 */
	public async getLanguages(): Promise<{ code: string; name: string }[]> {
		const response = await fetch(`${this.baseUrl}/languages`);

		if (!response.ok) {
			const message = `LibreTranslate /languages error ${response.status}: ${await response.text()}`;
			this.logger.error(message);
			throw new Error(message);
		}

		return response.json() as Promise<{ code: string; name: string }[]>;
	}

	/**
	 * Returns `true` if the LibreTranslate service is reachable, `false` otherwise.
	 */
	public async isAvailable(): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/languages`);
			return response.ok;
		} catch {
			return false;
		}
	}
}
