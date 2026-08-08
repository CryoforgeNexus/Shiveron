/**
 * Maps ISO 3166-1 alpha-2 country codes (lowercase) to BCP 47 language codes understood by LibreTranslate. Only includes countries where the primary language is unambiguous enough to be useful for auto-translation.
 */
const COUNTRY_TO_LANG: Readonly<Record<string, string>> = {
	// A
	ae: 'ar',
	af: 'fa',
	al: 'sq',
	am: 'hy',
	ao: 'pt',
	ar: 'es',
	at: 'de',
	az: 'az',
	// B
	ba: 'bs',
	bd: 'bn',
	be: 'nl',
	bg: 'bg',
	bh: 'ar',
	bn: 'ms',
	bo: 'es',
	br: 'pt',
	by: 'be',
	// C
	ca: 'en',
	ch: 'de',
	cl: 'es',
	cn: 'zh',
	co: 'es',
	cr: 'es',
	cu: 'es',
	cy: 'el',
	cz: 'cs',
	// D
	de: 'de',
	dk: 'da',
	dz: 'ar',
	// E
	ec: 'es',
	ee: 'et',
	eg: 'ar',
	es: 'es',
	et: 'am',
	// F
	fi: 'fi',
	fr: 'fr',
	// G
	gb: 'en',
	ge: 'ka',
	gh: 'en',
	gr: 'el',
	gt: 'es',
	// H
	hk: 'zh',
	hn: 'es',
	hr: 'hr',
	hu: 'hu',
	// I
	id: 'id',
	ie: 'en',
	il: 'he',
	in: 'hi',
	iq: 'ar',
	ir: 'fa',
	is: 'is',
	it: 'it',
	// J
	jo: 'ar',
	jp: 'ja',
	// K
	ke: 'sw',
	kg: 'ky',
	kh: 'km',
	kr: 'ko',
	kw: 'ar',
	kz: 'kk',
	// L
	la: 'lo',
	lb: 'ar',
	lk: 'si',
	lt: 'lt',
	lv: 'lv',
	ly: 'ar',
	// M
	ma: 'ar',
	md: 'ro',
	mk: 'mk',
	mm: 'my',
	mn: 'mn',
	mo: 'zh',
	mx: 'es',
	my: 'ms',
	// N
	ng: 'en',
	ni: 'es',
	nl: 'nl',
	no: 'nb',
	np: 'ne',
	nz: 'en',
	// O
	om: 'ar',
	// P
	pa: 'es',
	pe: 'es',
	ph: 'tl',
	pk: 'ur',
	pl: 'pl',
	pr: 'es',
	pt: 'pt',
	py: 'es',
	// Q
	qa: 'ar',
	// R
	ro: 'ro',
	rs: 'sr',
	ru: 'ru',
	// S
	sa: 'ar',
	sd: 'ar',
	se: 'sv',
	sg: 'en',
	si: 'sl',
	sk: 'sk',
	sl: 'en',
	sn: 'fr',
	so: 'so',
	sv: 'es',
	sy: 'ar',
	// T
	th: 'th',
	tj: 'tg',
	tm: 'tk',
	tn: 'ar',
	tr: 'tr',
	tw: 'zh',
	// U
	ua: 'uk',
	ug: 'en',
	us: 'en',
	uy: 'es',
	uz: 'uz',
	// V
	ve: 'es',
	vn: 'vi',
	// Y
	ye: 'ar',
	// Z
	za: 'af',
	zw: 'en',
};

/** Maps BCP 47 language codes to their most canonical representative country code. */
const LANG_TO_COUNTRY: Readonly<Record<string, string>> = {
	af: 'za',
	am: 'et',
	ar: 'sa',
	az: 'az',
	be: 'by',
	bg: 'bg',
	bn: 'bd',
	bs: 'ba',
	cs: 'cz',
	cy: 'gb',
	da: 'dk',
	de: 'de',
	el: 'gr',
	en: 'us',
	es: 'es',
	et: 'ee',
	fa: 'ir',
	fi: 'fi',
	fr: 'fr',
	he: 'il',
	hi: 'in',
	hr: 'hr',
	hu: 'hu',
	hy: 'am',
	id: 'id',
	is: 'is',
	it: 'it',
	ja: 'jp',
	ka: 'ge',
	kk: 'kz',
	km: 'kh',
	ko: 'kr',
	ky: 'kg',
	lo: 'la',
	lt: 'lt',
	lv: 'lv',
	mk: 'mk',
	mn: 'mn',
	ms: 'my',
	my: 'mm',
	nb: 'no',
	ne: 'np',
	nl: 'nl',
	pl: 'pl',
	pt: 'pt',
	ro: 'ro',
	ru: 'ru',
	si: 'lk',
	sk: 'sk',
	sl: 'si',
	so: 'so',
	sq: 'al',
	sr: 'rs',
	sv: 'se',
	sw: 'ke',
	tg: 'tj',
	th: 'th',
	tl: 'ph',
	tk: 'tm',
	tr: 'tr',
	uk: 'ua',
	ur: 'pk',
	uz: 'uz',
	vi: 'vn',
	zh: 'cn',
};

/** Converts an ISO 3166-1 alpha-2 country code (e.g. "fr") to its flag emoji (e.g. 🇫🇷). */
export function countryCodeToFlagEmoji(countryCode: string): string {
	return [...countryCode.toUpperCase()].map((c) => String.fromCodePoint(c.charCodeAt(0) + 0x1f1a5)).join('');
}

/**
 * Returns the flag emoji for a given BCP 47 language code (e.g. "fr" → 🇫🇷). Returns an empty string if the language has no canonical country in the map.
 */
export function langCodeToFlagEmoji(langCode: string): string {
	const country = LANG_TO_COUNTRY[langCode];
	return country ? countryCodeToFlagEmoji(country) : '';
}

/**
 * Converts a flag emoji (e.g. 🇫🇷) to a LibreTranslate language code (e.g. "fr"). Returns `null` if the emoji is not a valid two-letter regional-indicator flag or the country has no unambiguous primary language in the map.
 */
export function flagEmojiToLangCode(emoji: string): string | null {
	const codePoints = [...emoji].map((c) => c.codePointAt(0) ?? 0);
	if (codePoints.length !== 2) return null;

	const [a, b] = codePoints;
	if (a === undefined || b === undefined) return null;

	// Regional Indicator Symbols: U+1F1E6 (🇦) – U+1F1FF (🇿)
	if (a < 0x1f1e6 || a > 0x1f1ff || b < 0x1f1e6 || b > 0x1f1ff) return null;

	const countryCode = String.fromCharCode(a - 0x1f1a5, b - 0x1f1a5).toLowerCase();
	return COUNTRY_TO_LANG[countryCode] ?? null;
}
