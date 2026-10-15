import { inArray, notInArray } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

export function filterByQuery(url: string, column: SQLiteColumn, key: string) {
	const values = new URL(url).searchParams
		.get(key)
		?.split(',')
		.filter(Boolean)
		.map((part) => /^(?<negation>!|-)?(?<value>.+)$/.exec(part)!.groups!)
		.map(({ negation, value }) => ({
			negation: Boolean(negation),
			value: value!
		}));

	if (!values) return [];

	const includes = values.filter((v) => !v.negation).map((v) => v.value);
	const excludes = values.filter((v) => v.negation).map((v) => v.value);

	return [
		includes.length > 0 ? inArray(column, includes) : undefined,
		excludes.length > 0 ? notInArray(column, excludes) : undefined
	];
}
