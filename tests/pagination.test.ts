import { describe, expect, test, mock } from 'bun:test';
import { paginated, PaginatedResponseSchema, type PaginatedResponse } from '../src/pagination.js';
import { CorsedResponse as Response } from '../src/cors.js';

describe('Pagination Tests', () => {
	describe('PaginatedResponseSchema', () => {
		test('should be defined and exportable', () => {
			expect(PaginatedResponseSchema).toBeDefined();
			expect(typeof PaginatedResponseSchema).toBe('function');
		});

		test('PaginatedResponse type should have correct structure', () => {
			// Test the TypeScript type works as expected
			const testResponse: PaginatedResponse<{ id: number }> = {
				next_url: 'http://example.com/page2',
				items: [{ id: 1 }]
			};

			expect(testResponse.next_url).toBe('http://example.com/page2');
			expect(testResponse.items).toHaveLength(1);
			expect(testResponse.items[0].id).toBe(1);
		});

		test('PaginatedResponse type should support null next_url', () => {
			const testResponse: PaginatedResponse<{ name: string }> = {
				next_url: null,
				items: [{ name: 'test' }, { name: 'test2' }]
			};

			expect(testResponse.next_url).toBeNull();
			expect(testResponse.items).toHaveLength(2);
		});

		test('PaginatedResponse type should support empty items', () => {
			const testResponse: PaginatedResponse<any> = {
				next_url: null,
				items: []
			};

			expect(testResponse.next_url).toBeNull();
			expect(testResponse.items).toHaveLength(0);
		});
	});

	describe('paginated function', () => {
		// Mock request object
		const createMockRequest = (url: string): Bun.BunRequest =>
			({
				url,
				method: 'GET',
				headers: new Headers(),
				body: null,
				json: async () => ({}),
				text: async () => '',
				arrayBuffer: async () => new ArrayBuffer(0),
				blob: async () => new Blob(),
				formData: async () => new FormData(),
				clone: () => createMockRequest(url)
			}) as Bun.BunRequest;

		test('should handle basic pagination with default parameters', async () => {
			const mockGetItems = mock(async (req, { limit, offset }) => {
				return {
					items: [
						{ id: offset + 1, name: `item${offset + 1}` },
						{ id: offset + 2, name: `item${offset + 2}` }
					],
					hasNext: offset + limit < 10 // Simulate 10 total items
				};
			});

			const paginatedHandler = paginated(5, mockGetItems);
			const request = createMockRequest('http://example.com/test');

			const response = await paginatedHandler(request);
			const data = (await response.json()) as PaginatedResponse<any>;

			expect(mockGetItems).toHaveBeenCalledWith(request, { limit: 5, offset: 0 });
			expect(data.items).toHaveLength(2);
			expect(data.items[0]).toEqual({ id: 1, name: 'item1' });
			expect(data.next_url).toBe('http://example.com/test?page=2');
		});

		test('should handle custom page and pagesize parameters', async () => {
			const mockGetItems = mock(async (req, { limit: _limit, offset }) => {
				return {
					items: [
						{ id: offset + 1, name: `item${offset + 1}` },
						{ id: offset + 2, name: `item${offset + 2}` },
						{ id: offset + 3, name: `item${offset + 3}` }
					],
					hasNext: false
				};
			});

			const paginatedHandler = paginated(10, mockGetItems);
			const request = createMockRequest('http://example.com/test?page=3&pagesize=3');

			const response = await paginatedHandler(request);
			const data = (await response.json()) as PaginatedResponse<any>;

			expect(mockGetItems).toHaveBeenCalledWith(request, { limit: 3, offset: 6 }); // (page 3 - 1) * 3
			expect(data.items).toHaveLength(3);
			expect(data.next_url).toBeNull(); // hasNext is false
		});

		test('should reject pagesize larger than maximum', async () => {
			const mockGetItems = mock(async () => ({ items: [], hasNext: false }));
			const paginatedHandler = paginated(5, mockGetItems);
			const request = createMockRequest('http://example.com/test?pagesize=10');

			const response = await paginatedHandler(request);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data).toEqual({ error: 'Max pagesize is 5' });
			expect(mockGetItems).not.toHaveBeenCalled();
		});

		test('should handle string parameters correctly', async () => {
			const mockGetItems = mock(async (_req, { limit: _limit, offset: _offset }) => ({
				items: [{ id: 1, name: 'test' }],
				hasNext: false
			}));

			const paginatedHandler = paginated(10, mockGetItems);
			const request = createMockRequest('http://example.com/test?page=2&pagesize=3');

			const response = await paginatedHandler(request);
			await response.json();

			expect(mockGetItems).toHaveBeenCalledWith(request, { limit: 3, offset: 3 });
		});

		test('should handle last page correctly', async () => {
			const mockGetItems = mock(async () => ({
				items: [{ id: 10, name: 'last item' }],
				hasNext: false
			}));

			const paginatedHandler = paginated(5, mockGetItems);
			const request = createMockRequest('http://example.com/test?page=3');

			const response = await paginatedHandler(request);
			const data = (await response.json()) as PaginatedResponse<any>;

			expect(data.next_url).toBeNull();
			expect(data.items).toHaveLength(1);
		});

		test('should preserve existing query parameters when generating next_url', async () => {
			const mockGetItems = mock(async () => ({
				items: [{ id: 1, name: 'test' }],
				hasNext: true
			}));

			const paginatedHandler = paginated(5, mockGetItems);
			const request = createMockRequest('http://example.com/test?filter=active&sort=name');

			const response = await paginatedHandler(request);
			const data = (await response.json()) as PaginatedResponse<any>;

			expect(data.next_url).toBe('http://example.com/test?filter=active&sort=name&page=2');
		});

		test('should handle Response errors from getItems', async () => {
			// Create a mock error that extends Response like CorsedResponse does
			const errorResponse = new Response(JSON.stringify({ error: 'Database error' }), {
				status: 500
			});
			const mockGetItems = mock(async () => {
				throw errorResponse;
			});

			const paginatedHandler = paginated(5, mockGetItems);
			const request = createMockRequest('http://example.com/test');

			const response = await paginatedHandler(request);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data).toEqual({ error: 'Database error' });
		});

		test('should re-throw non-Response errors', async () => {
			const mockGetItems = mock(async () => {
				throw new Error('Generic error');
			});

			const paginatedHandler = paginated(5, mockGetItems);
			const request = createMockRequest('http://example.com/test');

			await expect(paginatedHandler(request)).rejects.toThrow('Generic error');
		});

		test('should handle empty results', async () => {
			const mockGetItems = mock(async () => ({
				items: [],
				hasNext: false
			}));

			const paginatedHandler = paginated(10, mockGetItems);
			const request = createMockRequest('http://example.com/test');

			const response = await paginatedHandler(request);
			const data = (await response.json()) as PaginatedResponse<any>;

			expect(data.items).toHaveLength(0);
			expect(data.next_url).toBeNull();
		});

		test('should handle page parameter edge cases', async () => {
			const mockGetItems = mock(async (_req, { limit: _limit, offset: _offset }) => ({
				items: [],
				hasNext: false
			}));

			const paginatedHandler = paginated(5, mockGetItems);

			// Test page = 1 (should work normally)
			let request = createMockRequest('http://example.com/test?page=1');
			await paginatedHandler(request);
			expect(mockGetItems).toHaveBeenCalledWith(request, { limit: 5, offset: 0 });

			mockGetItems.mockClear();

			// Test invalid page parameter (should default to 1)
			request = createMockRequest('http://example.com/test?page=invalid');
			await expect(paginatedHandler(request)).rejects.toThrow();
		});
	});
});
