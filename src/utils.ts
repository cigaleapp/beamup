import { styleText } from 'node:util';

export function omit<T extends Record<string, any>, K extends keyof T>(
	obj: null | T,
	...key: K[]
): Omit<T, K> | null {
	if (!obj) return null;
	const copy = { ...obj };
	for (const k of key) {
		delete copy[k];
	}
	return copy;
}

export function uniqueBy<T, K>(arr: T[], keyFn: (item: T) => K): T[] {
	const seen = new Set<K>();
	const result: T[] = [];
	for (const item of arr) {
		const key = keyFn(item);
		if (!seen.has(key)) {
			seen.add(key);
			result.push(item);
		}
	}
	return result;
}

export function chunk<T>(arr: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		chunks.push(arr.slice(i, i + size));
	}
	return chunks;
}

export const cli = {
	strong: (str: string | number) => styleText(['bold', 'cyanBright'], str.toString()),
	em: (str: string | number) => styleText(['blueBright', 'italic'], str.toString()),
	boolean: (val: unknown, falseWord = 'false', trueWord = 'true') =>
		styleText(['bold', val ? 'green' : 'red'], val ? trueWord : falseWord)
};
