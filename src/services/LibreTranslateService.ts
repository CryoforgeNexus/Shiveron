import { eld } from 'eld/large';
import { ShiveronLogger } from '../core/ShiveronLogger.js';
import { getConfig } from '../utils/config.js';
import {
	TRANSLATION_CACHE_MAX_ENTRIES,
	TRANSLATION_MIN_MESSAGE_LENGTH,
	TRANSLATION_MIN_SCORE_GAP,
	TRANSLATION_PROBE_TIMEOUT_MS,
	TRANSLATION_REQUEST_TIMEOUT_MS,
} from '../utils/constants.js';
import {
	hasTranslatableText,
	maskProtectedSpans,
	stripProtectedSpans,
	unmaskProtectedSpans,
} from '../utils/translationText.js';

/** Language codes the detector and LibreTranslate spell differently, mapped to LibreTranslate's spellings in order of preference. */
const LIBRETRANSLATE_ALIASES: Readonly<Record<string, readonly string[]>> = {
	no: ['nb'],
	zh: ['zh-Hans'],
};

/** The language detected for a text. */
export interface LanguageDetection {
	/** ISO 639-1 code as reported by the detector. */
	language: string;
	/** Whether the detector trusts its own top guess; similar languages (Russian and Bulgarian, Spanish and Catalan) on short text often are not. */
	reliable: boolean;
	/** Uncalibrated 0–1 score per candidate language. Only comparisons between scores of the same text are meaningful. */
	scores: Record<string, number>;
}

/** The outcome of a translation. */
export interface TranslationResult {
	translatedText: string;
	/** LibreTranslate code of the language translated from, or `null` when it could not be determined. */
	sourceLanguage: string | null;
}

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
 * Wraps the LibreTranslate HTTP API, with language detection done locally.
 *
 * Supports:
 * - Single-string translation, with the source language detected locally when not given
 * - Local language detection, restricted to the languages the running instance can translate
 * - Listing all languages supported by the running instance
 * - Health check to detect when the service is unavailable
 *
 * Detection runs in-process with `eld` rather than through LibreTranslate's `/detect`: it is accurate on short chat text, costs no round trip, and lets every message be screened before anything is sent to the instance. Before translating, mentions, links, code, emoji and similar spans are swapped for placeholders and restored afterwards, so the engine sees only prose. Translation results are cached in memory.
 */
export class LibreTranslateService {
	private readonly baseUrl: string;
	private readonly logger: ShiveronLogger;
	private readonly translationCache = new LRUCache<TranslationResult>(TRANSLATION_CACHE_MAX_ENTRIES);
	private languages: { code: string; name: string }[] | null = null;
	private supportedCodes: Set<string> | null = null;

	public constructor(logger: ShiveronLogger) {
		this.logger = logger;
		this.baseUrl = getConfig('LIBRETRANSLATE_URL');
	}

	/**
	 * Issues a request to the LibreTranslate instance and parses the JSON response, aborting once the deadline elapses.
	 *
	 * The deadline is the point of the helper. Undici's own timeouts are measured in minutes, so a wedged backend would otherwise hold a message handler or an interaction open long past the point where the caller could still act on a result.
	 *
	 * @param path - Endpoint path, appended to the configured base URL.
	 * @param timeoutMs - Milliseconds to wait before the request is aborted.
	 * @param body - Payload to send as JSON. Omitting it issues a GET.
	 * @returns The parsed response body.
	 * @throws When the request is aborted, the connection fails, or the instance answers with a non-2xx status.
	 */
	private async request<T>(path: string, timeoutMs: number, body?: unknown): Promise<T> {
		const response = await fetch(`${this.baseUrl}${path}`, {
			signal: AbortSignal.timeout(timeoutMs),
			...(body === undefined
				? {}
				: {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(body),
					}),
		});

		if (!response.ok) {
			const message = `LibreTranslate ${path} error ${response.status}: ${await response.text()}`;
			this.logger.error(message);
			throw new Error(message);
		}

		return response.json() as Promise<T>;
	}

	/**
	 * Translates a string into the target language.
	 *
	 * Without an explicit source, the language is detected locally; a guess the detector does not trust is left to LibreTranslate (`"auto"`) rather than forced, since a wrong explicit source produces worse output than the engine's own detection. Protected spans are masked during translation; if the engine loses a placeholder, the unmasked text is translated instead.
	 *
	 * @param text - The text to translate.
	 * @param targetLang - Code of the desired output language (e.g. `"es"`). Detector spellings such as `"no"` are mapped to the instance's own.
	 * @param sourceLang - Code of the input language, or omitted to detect it.
	 * @returns The translation and the language it was translated from. When the source already is the target, the text is returned unchanged without a request.
	 * @throws When the instance does not support the target language, or the request fails.
	 */
	public async translate(text: string, targetLang: string, sourceLang?: string): Promise<TranslationResult> {
		await this.loadLanguages();

		const target = this.toLibreTranslateCode(targetLang);
		if (!target) {
			throw new Error(`LibreTranslate does not support target language ${targetLang}.`);
		}

		const detection = sourceLang ? null : this.detect(text);
		const requestedSource = sourceLang ?? (detection?.reliable ? detection.language : 'auto');
		const source = requestedSource === 'auto' ? 'auto' : (this.toLibreTranslateCode(requestedSource) ?? 'auto');

		if (source === target) {
			return { translatedText: text, sourceLanguage: source };
		}

		const cacheKey = `${source}:${target}:${text}`;
		const cached = this.translationCache.get(cacheKey);
		if (cached) {
			this.logger.debug(`LibreTranslate /translate cache hit for ${source} to ${target}.`);
			return cached;
		}

		const { masked, spans } = maskProtectedSpans(text);
		if (!hasTranslatableText(masked)) {
			return { translatedText: text, sourceLanguage: source === 'auto' ? null : source };
		}

		const startedAt = Date.now();
		let data = await this.requestTranslation(masked, source, target);
		let translatedText = unmaskProtectedSpans(data.translatedText, spans);
		if (translatedText === null) {
			this.logger.debug(`LibreTranslate lost a placeholder for ${source} to ${target}; retrying unmasked.`);
			data = await this.requestTranslation(text, source, target);
			translatedText = data.translatedText;
		}

		const result: TranslationResult = {
			translatedText,
			sourceLanguage: source === 'auto' ? (data.detectedLanguage?.language ?? null) : source,
		};

		this.translationCache.set(cacheKey, result);
		this.logger.debug(`LibreTranslate /translate took ${Date.now() - startedAt}ms for ${source} to ${target}.`);
		return result;
	}

	/**
	 * Sends one text to `/translate`.
	 * @param text - The text to send, masked or not.
	 * @param source - LibreTranslate code of the source language, or `"auto"`.
	 * @param target - LibreTranslate code of the target language.
	 * @returns The engine's raw answer, with its own detection when the source was `"auto"`.
	 */
	private async requestTranslation(
		text: string,
		source: string,
		target: string,
	): Promise<{ translatedText: string; detectedLanguage?: { language: string; confidence: number } }> {
		return this.request('/translate', TRANSLATION_REQUEST_TIMEOUT_MS, {
			q: text,
			source,
			target,
			format: 'text',
		});
	}

	/**
	 * Detects the language of a text locally, ignoring mentions, links, code and emoji. Synchronous and free of network access.
	 *
	 * @param text - The text whose language should be identified.
	 * @returns The detection, or `null` when the text holds no prose or the detector has no guess.
	 */
	public detect(text: string): LanguageDetection | null {
		const prose = stripProtectedSpans(text);
		if (!hasTranslatableText(prose)) {
			return null;
		}

		const result = eld.detect(prose);
		if (!result.language) {
			return null;
		}

		return { language: result.language, reliable: result.isReliable(), scores: result.getScores() };
	}

	/**
	 * Decides whether a message is confidently written in a language other than the expected one, which is the bar for translating it unprompted.
	 *
	 * The detector's top guess is not enough on chat text: slang and abbreviations ("lol idk") often score a neighbouring language first. The guess must also lead the expected language's own score by `TRANSLATION_MIN_SCORE_GAP`.
	 *
	 * @param text - The message text.
	 * @param expectedLanguage - Code of the language the message is expected to be in, usually the server's.
	 * @returns The detection when the message should be translated, otherwise `null`.
	 */
	public detectForeignLanguage(text: string, expectedLanguage: string): LanguageDetection | null {
		if (stripProtectedSpans(text).length < TRANSLATION_MIN_MESSAGE_LENGTH) {
			return null;
		}

		const detection = this.detect(text);
		if (!detection || detection.language === expectedLanguage) {
			return null;
		}

		const gap = (detection.scores[detection.language] ?? 0) - (detection.scores[expectedLanguage] ?? 0);
		return gap >= TRANSLATION_MIN_SCORE_GAP ? detection : null;
	}

	/**
	 * Maps a language code to the instance's spelling of it.
	 * @param code - A detector or LibreTranslate language code.
	 * @returns The instance's code, or `null` when it does not support the language. Before the language list has loaded, the code is returned unchanged.
	 */
	public async resolveLanguage(code: string): Promise<string | null> {
		await this.loadLanguages();
		return this.toLibreTranslateCode(code);
	}

	/**
	 * Synchronous core of `resolveLanguage`, for callers that already awaited the language list.
	 * @param code - A detector or LibreTranslate language code.
	 * @returns The instance's code, `null` when unsupported, or the code unchanged when the list is unknown.
	 */
	private toLibreTranslateCode(code: string): string | null {
		if (!this.supportedCodes) {
			return code;
		}

		const candidates = [code, ...(LIBRETRANSLATE_ALIASES[code] ?? [])];
		return candidates.find((candidate) => this.supportedCodes?.has(candidate)) ?? null;
	}

	/**
	 * Fetches the language list once, so codes can be resolved and the detector restricted to translatable languages. A failure is logged and retried on the next call; until then, codes pass through unchecked.
	 */
	private async loadLanguages(): Promise<void> {
		if (this.supportedCodes) {
			return;
		}

		try {
			await this.getLanguages();
		} catch (error) {
			this.logger.warn(`Could not load the LibreTranslate language list: ${error}`);
		}
	}

	/**
	 * Returns the list of languages supported by this LibreTranslate instance, fetched once and then served from memory. The first successful fetch also restricts the local detector to languages the instance can translate, which removes candidates that could only cause a mistranslation.
	 * @returns The instance's languages, each with its code and English name.
	 */
	public async getLanguages(): Promise<{ code: string; name: string }[]> {
		if (this.languages) {
			return this.languages;
		}

		const languages = await this.request<{ code: string; name: string }[]>(
			'/languages',
			TRANSLATION_REQUEST_TIMEOUT_MS,
		);
		this.languages = languages;
		this.supportedCodes = new Set(languages.map((language) => language.code));

		const detectable = Object.values(eld.info().Languages).filter(
			(code) => this.toLibreTranslateCode(code) !== null,
		);
		eld.setLanguageSubset(detectable);
		this.logger.debug(`Restricted language detection to ${detectable.length} translatable languages.`);

		return languages;
	}

	/**
	 * Returns `true` if the LibreTranslate service is reachable, `false` otherwise.
	 *
	 * Deliberately bypasses `request`, which logs a failure as an error. An unreachable backend is reported by the caller as a warning, and is held to a shorter deadline than a translation because the endpoint serves a static list.
	 */
	public async isAvailable(): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/languages`, {
				signal: AbortSignal.timeout(TRANSLATION_PROBE_TIMEOUT_MS),
			});
			return response.ok;
		} catch {
			return false;
		}
	}
}
