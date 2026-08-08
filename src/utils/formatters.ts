/**
 * Replaces all `${key}` placeholders in a template string with the corresponding values from `data`.
 * @param template - A string containing `${key}` placeholders.
 * @param data - A key-value map where each key matches a placeholder in the template.
 * @returns The template with all matching placeholders replaced by their stringified values.
 */
export function interpolate(template: string, data: Record<string, any>): string {
	let result = template;
	for (const [arg, val] of Object.entries(data)) {
		const pattern = new RegExp(`\\$\\{${arg}\\}`, 'g');
		result = result.replace(pattern, String(val));
	}
	return result;
}

import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE, MS_PER_MONTH, MS_PER_YEAR } from './constants.js';

/**
 * Parses a human-readable time string (e.g., `"30min"`, `"2h"`, `"7d"`, `"1m"`, `"1y"`) into milliseconds.
 * @param timeString - A string consisting of a positive integer followed by a unit suffix:   `min` (minutes), `h` (hours), `d` (days), `m` (months ~30d), `y` (years ~360d).
 * @returns The equivalent duration in milliseconds.
 * @throws If the string is malformed, the number is ≤ 0, or the unit is unrecognized.
 */
export function timeFromString(timeString: string): number | null {
	let time;

	if (timeString && timeString.length > 1) {
		let slicedTime;
		let slicedUnit;
		if (timeString.toLowerCase().endsWith('min')) {
			slicedTime = timeString.slice(0, -3);
			slicedUnit = 'min';
		} else {
			slicedTime = timeString.slice(0, -1);
			slicedUnit = timeString.slice(-1).toLowerCase();
		}

		if (!isNaN(Number(slicedTime))) {
			const slicedTimeInt = parseInt(slicedTime);
			if (slicedTimeInt <= 0) {
				throw new Error('The time cannot be equal or inferior to 0');
			}

			switch (slicedUnit) {
				case 'min':
					time = slicedTimeInt * MS_PER_MINUTE;
					break;
				case 'h':
					time = slicedTimeInt * MS_PER_HOUR;
					break;
				case 'd':
					time = slicedTimeInt * MS_PER_DAY;
					break;
				case 'm':
					time = slicedTimeInt * MS_PER_MONTH;
					break;
				case 'y':
					time = slicedTimeInt * MS_PER_YEAR;
					break;
				default:
					throw new Error(`No matching unit for ${slicedUnit}`);
			}
		} else {
			throw new Error('The time has to be a number');
		}
	} else {
		throw new Error('Wrong parsing for the date');
	}

	return time;
}
