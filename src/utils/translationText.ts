/**
 * Spans a translation engine must not touch: fenced and inline code, Discord mentions, custom emoji and timestamps, URLs, `@everyone`/`@here`, unicode emoji and flags, and any text that already looks like a placeholder (so it is restored verbatim instead of being mistaken for one).
 */
const PROTECTED_SPAN =
	/```[\s\S]*?```|`[^`\n]+`|<(?:@[!&]?\d+|#\d+|a?:\w+:\d+|t:-?\d+(?::[tTdDfFR])?|\/[\w -]+:\d+)>|<?https?:\/\/[^\s<>]+>?|@(?:everyone|here)|[\u{1F1E6}-\u{1F1FF}]{2}|\p{Extended_Pictographic}(?:️|[\u{1F3FB}-\u{1F3FF}]|‍\p{Extended_Pictographic})*|\[\s*\d+\s*\]/gu;

// Engines tend to pad brackets with spaces, so restoration accepts them.
const PLACEHOLDER = /\[\s*(\d+)\s*\]/g;

const LETTER = /\p{L}/u;

/** A text whose protected spans were swapped for numbered placeholders, with the spans needed to restore it. */
export interface MaskedText {
	masked: string;
	spans: string[];
}

/**
 * Replaces every protected span with a numbered placeholder (`[0]`, `[1]`, ...), so the engine translates only prose.
 * @param text - The original message text.
 * @returns The masked text and the spans, indexed by placeholder number.
 */
export function maskProtectedSpans(text: string): MaskedText {
	const spans: string[] = [];
	const masked = text.replace(PROTECTED_SPAN, (span) => {
		spans.push(span);
		return `[${spans.length - 1}]`;
	});
	return { masked, spans };
}

/**
 * Puts the protected spans back into a translated text.
 * @param translated - The engine's output for a masked text.
 * @param spans - The spans returned by `maskProtectedSpans`.
 * @returns The restored text, or `null` when a placeholder was lost or duplicated, in which case the masked translation cannot be trusted.
 */
export function unmaskProtectedSpans(translated: string, spans: string[]): string | null {
	const seen = new Set<number>();
	const restored = translated.replace(PLACEHOLDER, (placeholder, index: string) => {
		const position = Number(index);
		const span = spans[position];
		if (span === undefined) {
			return placeholder;
		}
		seen.add(position);
		return span;
	});

	const placeholderCount = translated.match(PLACEHOLDER)?.length ?? 0;
	if (seen.size !== spans.length || placeholderCount !== spans.length) {
		return null;
	}
	return restored;
}

/**
 * Removes every protected span and collapses whitespace, leaving only the prose a language detector should judge.
 * @param text - The original message text.
 * @returns The prose, possibly empty.
 */
export function stripProtectedSpans(text: string): string {
	return text.replace(PROTECTED_SPAN, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Tells whether a text contains anything a translation engine could translate.
 * @param text - The text to check, masked or stripped.
 * @returns `true` when the text contains at least one letter.
 */
export function hasTranslatableText(text: string): boolean {
	return LETTER.test(text);
}
