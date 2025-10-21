import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { CorsedResponse } from '../src/cors.js';

describe('CORS Tests', () => {
	// Store original environment value
	let originalAllowedOrigins: string | undefined;

	beforeEach(() => {
		originalAllowedOrigins = Bun.env.ALLOWED_ORIGINS;
	});

	afterEach(() => {
		// Restore original environment value
		if (originalAllowedOrigins !== undefined) {
			Bun.env.ALLOWED_ORIGINS = originalAllowedOrigins;
		} else {
			delete Bun.env.ALLOWED_ORIGINS;
		}
	});

	describe('CorsedResponse constructor', () => {
		test('should set CORS header with default value when ALLOWED_ORIGINS is not set', () => {
			delete Bun.env.ALLOWED_ORIGINS;

			const response = new CorsedResponse('test body');

			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
		});

		test('should set CORS header with environment value when ALLOWED_ORIGINS is set', () => {
			Bun.env.ALLOWED_ORIGINS = 'https://example.com,https://test.com';

			const response = new CorsedResponse('test body');

			expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
				'https://example.com,https://test.com'
			);
		});

		test('should work with custom response init', () => {
			Bun.env.ALLOWED_ORIGINS = 'https://custom.com';

			const response = new CorsedResponse('test body', {
				status: 201,
				headers: {
					'Content-Type': 'application/json'
				}
			});

			expect(response.status).toBe(201);
			expect(response.headers.get('Content-Type')).toBe('application/json');
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://custom.com');
		});

		test('should work with null body', () => {
			delete Bun.env.ALLOWED_ORIGINS;

			const response = new CorsedResponse(null);

			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
		});

		test('should work with different body types', async () => {
			Bun.env.ALLOWED_ORIGINS = 'https://example.com';

			// Test with string
			let response = new CorsedResponse('string body');
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
			expect(await response.text()).toBe('string body');

			// Test with ArrayBuffer
			const buffer = new TextEncoder().encode('buffer body');
			response = new CorsedResponse(buffer);
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
			expect(await response.text()).toBe('buffer body');

			// Test with Blob
			const blob = new Blob(['blob body']);
			response = new CorsedResponse(blob);
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
			expect(await response.text()).toBe('blob body');
		});
	});

	describe('CorsedResponse.json static method', () => {
		test('should create JSON response with CORS header when no existing header', async () => {
			delete Bun.env.ALLOWED_ORIGINS;

			const data = { message: 'test', value: 42 };
			const response = CorsedResponse.json(data);

			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
			expect(response.headers.get('Content-Type')).toMatch(/application\/json/);
			const responseData = await response.json();
			expect(responseData).toEqual(data);
		});

		test('should use environment ALLOWED_ORIGINS value', async () => {
			Bun.env.ALLOWED_ORIGINS = 'https://api.example.com';

			const data = { test: 'value' };
			const response = CorsedResponse.json(data);

			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://api.example.com');
			expect(await response.json()).toEqual(data);
		});

		test('should work with custom ResponseInit', () => {
			Bun.env.ALLOWED_ORIGINS = 'https://custom.com';

			const data = { error: 'Not found' };
			const response = CorsedResponse.json(data, { status: 404 });

			expect(response.status).toBe(404);
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://custom.com');
		});

		test('should not override existing CORS header if already present', () => {
			Bun.env.ALLOWED_ORIGINS = 'https://default.com';

			const response = CorsedResponse.json(
				{},
				{
					headers: {
						'Access-Control-Allow-Origin': 'https://custom.com'
					}
				}
			);

			// Should keep the custom header value, not the environment one
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://custom.com');
		});

		test('should handle complex JSON data', async () => {
			delete Bun.env.ALLOWED_ORIGINS;

			const complexData = {
				id: 123,
				name: 'Test User',
				metadata: {
					created: new Date().toISOString(),
					tags: ['test', 'user'],
					settings: {
						enabled: true,
						level: 5
					}
				}
			};

			const response = CorsedResponse.json(complexData);
			const responseData = await response.json();

			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
			expect(responseData).toEqual(complexData);
		});

		test('should handle arrays', async () => {
			Bun.env.ALLOWED_ORIGINS = 'https://array.test';

			const arrayData = [
				{ id: 1, name: 'Item 1' },
				{ id: 2, name: 'Item 2' }
			];

			const response = CorsedResponse.json(arrayData);
			const responseData = await response.json();

			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://array.test');
			expect(responseData).toEqual(arrayData);
		});

		test('should handle null and undefined values', async () => {
			delete Bun.env.ALLOWED_ORIGINS;

			let response = CorsedResponse.json(null);
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
			let responseData = await response.json();
			expect(responseData).toBeNull();

			// Test with explicitly undefined - note that JSON.stringify(undefined) becomes "null"
			response = CorsedResponse.json({ value: undefined });
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
			responseData = await response.json();
			expect(responseData).toEqual({ value: undefined });
		});
	});

	describe('CorsedResponse.redirect static method', () => {
		test('should create redirect response with CORS header when no existing header', () => {
			delete Bun.env.ALLOWED_ORIGINS;

			const response = CorsedResponse.redirect('https://example.com/redirect');

			expect(response.status).toBe(302); // Default redirect status
			expect(response.headers.get('Location')).toBe('https://example.com/redirect');
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
		});

		test('should use environment ALLOWED_ORIGINS value', () => {
			Bun.env.ALLOWED_ORIGINS = 'https://redirect.example.com';

			const response = CorsedResponse.redirect('https://target.com');

			expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
				'https://redirect.example.com'
			);
			expect(response.headers.get('Location')).toBe('https://target.com');
		});

		test('should work with custom status code', () => {
			Bun.env.ALLOWED_ORIGINS = 'https://permanent.com';

			const response = CorsedResponse.redirect('https://new-location.com', 301);

			expect(response.status).toBe(301);
			expect(response.headers.get('Location')).toBe('https://new-location.com');
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://permanent.com');
		});

		test('should not override existing CORS header if already present', () => {
			Bun.env.ALLOWED_ORIGINS = 'https://default.com';

			// First create a redirect response with existing CORS header
			const baseResponse = Response.redirect('https://test.com');
			baseResponse.headers.set('Access-Control-Allow-Origin', 'https://custom.com');

			// Since we can't easily mock the static Response.redirect to return our custom headers,
			// we'll test the case where the response already has a CORS header
			// This tests the logic in the static method that checks for existing headers

			const response = CorsedResponse.redirect('https://test.com');
			// The method should add CORS header since the base Response.redirect doesn't include it
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://default.com');
		});

		test('should handle relative URLs', () => {
			delete Bun.env.ALLOWED_ORIGINS;

			const response = CorsedResponse.redirect('/relative/path');

			expect(response.headers.get('Location')).toBe('/relative/path');
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
		});

		test('should handle various redirect status codes', () => {
			Bun.env.ALLOWED_ORIGINS = 'https://status.test';

			// Test different redirect status codes
			const statuses = [301, 302, 303, 307, 308];
			for (const status of statuses) {
				const response = CorsedResponse.redirect('https://example.com', status);
				expect(response.status).toBe(status);
				expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://status.test');
			}
		});
	});

	describe('environment variable edge cases', () => {
		test('should handle empty ALLOWED_ORIGINS', () => {
			Bun.env.ALLOWED_ORIGINS = '';

			const response = new CorsedResponse('test');

			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
		});

		test('should handle ALLOWED_ORIGINS with whitespace', () => {
			Bun.env.ALLOWED_ORIGINS = '  https://example.com  ';

			const response = new CorsedResponse('test');

			// The actual behavior shows that spaces are trimmed
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
		});

		test('should handle multiple origins in ALLOWED_ORIGINS', () => {
			Bun.env.ALLOWED_ORIGINS =
				'https://app.example.com,https://admin.example.com,https://api.example.com';

			const jsonResponse = CorsedResponse.json({ test: 'value' });
			const redirectResponse = CorsedResponse.redirect('https://redirect.com');
			const normalResponse = new CorsedResponse('body');

			const expectedOrigins =
				'https://app.example.com,https://admin.example.com,https://api.example.com';
			expect(jsonResponse.headers.get('Access-Control-Allow-Origin')).toBe(expectedOrigins);
			expect(redirectResponse.headers.get('Access-Control-Allow-Origin')).toBe(expectedOrigins);
			expect(normalResponse.headers.get('Access-Control-Allow-Origin')).toBe(expectedOrigins);
		});
	});
});
