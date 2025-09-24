import { describe, expect, test } from 'bun:test';
import { omit, uniqueBy, chunk } from '../src/utils.js';

describe('Utils Tests', () => {
	describe('omit', () => {
		test('should omit specified keys from object', () => {
			const obj = { a: 1, b: 2, c: 3, d: 4 };
			const result = omit(obj, 'b', 'd');

			expect(result).toEqual({ a: 1, c: 3 });
			expect(result).not.toHaveProperty('b');
			expect(result).not.toHaveProperty('d');
		});

		test('should return null when input is null', () => {
			const result = omit(null, 'a', 'b');
			expect(result).toBeNull();
		});

		test('should return new object without mutating original', () => {
			const original = { a: 1, b: 2, c: 3 };
			const result = omit(original, 'b');

			expect(original).toEqual({ a: 1, b: 2, c: 3 }); // Original unchanged
			expect(result).toEqual({ a: 1, c: 3 });
			expect(result).not.toBe(original); // Different object reference
		});

		test('should handle empty key list', () => {
			const obj = { a: 1, b: 2 };
			const result = omit(obj);

			expect(result).toEqual({ a: 1, b: 2 });
			expect(result).not.toBe(obj); // Still creates new object
		});

		test('should handle non-existent keys', () => {
			const obj = { a: 1, b: 2 };
			const result = omit(obj, 'c' as any, 'd' as any);

			expect(result).toEqual({ a: 1, b: 2 });
		});

		test('should omit all keys if all are specified', () => {
			const obj = { a: 1, b: 2 };
			const result = omit(obj, 'a', 'b');

			expect(result).toEqual({});
		});
	});

	describe('uniqueBy', () => {
		test('should return unique items based on key function', () => {
			const items = [
				{ id: 1, name: 'Alice' },
				{ id: 2, name: 'Bob' },
				{ id: 1, name: 'Alice Duplicate' },
				{ id: 3, name: 'Charlie' },
				{ id: 2, name: 'Bob Duplicate' }
			];

			const result = uniqueBy(items, (item) => item.id);

			expect(result).toHaveLength(3);
			expect(result).toEqual([
				{ id: 1, name: 'Alice' },
				{ id: 2, name: 'Bob' },
				{ id: 3, name: 'Charlie' }
			]);
		});

		test('should return first occurrence of duplicate items', () => {
			const items = [
				{ id: 1, value: 'first' },
				{ id: 1, value: 'second' },
				{ id: 1, value: 'third' }
			];

			const result = uniqueBy(items, (item) => item.id);

			expect(result).toHaveLength(1);
			expect(result[0].value).toBe('first');
		});

		test('should handle empty array', () => {
			const result = uniqueBy([], (item: any) => item.id);
			expect(result).toEqual([]);
		});

		test('should work with primitive values', () => {
			const items = ['apple', 'banana', 'apple', 'cherry', 'banana'];
			const result = uniqueBy(items, (item) => item);

			expect(result).toEqual(['apple', 'banana', 'cherry']);
		});

		test('should work with complex key functions', () => {
			const items = [
				{ name: 'Alice', age: 25 },
				{ name: 'Bob', age: 30 },
				{ name: 'Charlie', age: 25 },
				{ name: 'David', age: 30 }
			];

			const result = uniqueBy(items, (item) => item.age);

			expect(result).toHaveLength(2);
			expect(result).toEqual([
				{ name: 'Alice', age: 25 },
				{ name: 'Bob', age: 30 }
			]);
		});

		test('should handle null/undefined keys', () => {
			const items = [
				{ id: null, name: 'A' },
				{ id: undefined, name: 'B' },
				{ id: null, name: 'C' },
				{ id: 1, name: 'D' }
			];

			const result = uniqueBy(items, (item) => item.id);

			expect(result).toHaveLength(3);
			expect(result.map((item) => item.name)).toEqual(['A', 'B', 'D']);
		});
	});

	describe('chunk', () => {
		test('should split array into chunks of specified size', () => {
			const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9];
			const result = chunk(arr, 3);

			expect(result).toEqual([
				[1, 2, 3],
				[4, 5, 6],
				[7, 8, 9]
			]);
		});

		test('should handle array not evenly divisible by chunk size', () => {
			const arr = [1, 2, 3, 4, 5, 6, 7, 8];
			const result = chunk(arr, 3);

			expect(result).toEqual([
				[1, 2, 3],
				[4, 5, 6],
				[7, 8]
			]);
		});

		test('should handle chunk size larger than array length', () => {
			const arr = [1, 2, 3];
			const result = chunk(arr, 5);

			expect(result).toEqual([[1, 2, 3]]);
		});

		test('should handle empty array', () => {
			const result = chunk([], 3);
			expect(result).toEqual([]);
		});

		test('should handle chunk size of 1', () => {
			const arr = [1, 2, 3];
			const result = chunk(arr, 1);

			expect(result).toEqual([[1], [2], [3]]);
		});

		test('should handle single element array', () => {
			const arr = [42];
			const result = chunk(arr, 3);

			expect(result).toEqual([[42]]);
		});

		test('should work with different data types', () => {
			const arr = ['a', 'b', 'c', 'd', 'e'];
			const result = chunk(arr, 2);

			expect(result).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
		});

		test('should work with objects', () => {
			const arr = [
				{ id: 1, name: 'A' },
				{ id: 2, name: 'B' },
				{ id: 3, name: 'C' },
				{ id: 4, name: 'D' },
				{ id: 5, name: 'E' }
			];
			const result = chunk(arr, 2);

			expect(result).toHaveLength(3);
			expect(result[0]).toEqual([
				{ id: 1, name: 'A' },
				{ id: 2, name: 'B' }
			]);
			expect(result[1]).toEqual([
				{ id: 3, name: 'C' },
				{ id: 4, name: 'D' }
			]);
			expect(result[2]).toEqual([{ id: 5, name: 'E' }]);
		});

		test('should not mutate original array', () => {
			const original = [1, 2, 3, 4, 5];
			const result = chunk(original, 2);

			expect(original).toEqual([1, 2, 3, 4, 5]); // Original unchanged
			expect(result).toEqual([[1, 2], [3, 4], [5]]);
		});
	});
});
