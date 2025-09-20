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

export function pick<T extends Record<string, any>, K extends keyof T>(
	obj: T,
	...key: K[]
): Pick<T, K> {
	if (!obj) return null;
	const copy = {} as Pick<T, K>;
	for (const k of key) {
		if (k in obj) copy[k] = obj[k];
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
