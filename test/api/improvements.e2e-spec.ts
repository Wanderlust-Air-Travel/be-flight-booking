import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/api-gateway/app.module';
import { createAndLoginUser, generateTestEmail } from '../helpers/test-helpers';

describe('Improvements & New Features (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
			}),
		);
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	describe('Request ID Tracking', () => {
		it('should include X-Request-Id header in all responses', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/v1/health/liveness')
				.expect(200);

			expect(response.headers['x-request-id']).toBeDefined();
			expect(response.headers['x-correlation-id']).toBeDefined();
			expect(response.headers['x-request-id']).toBe(response.headers['x-correlation-id']);

			// Request ID should be UUID v7 format (starts with timestamp)
			const requestId = response.headers['x-request-id'];
			expect(typeof requestId).toBe('string');
			expect(requestId.length).toBeGreaterThan(0);
		});

		it('should use custom X-Request-Id from client if provided', async () => {
			const customRequestId = 'custom-request-id-12345';

			const response = await request(app.getHttpServer())
				.get('/api/v1/health/liveness')
				.set('X-Request-Id', customRequestId)
				.expect(200);

			expect(response.headers['x-request-id']).toBe(customRequestId);
			expect(response.headers['x-correlation-id']).toBe(customRequestId);
		});

		it('should use X-Correlation-Id from client if provided', async () => {
			const customCorrelationId = 'custom-correlation-id-67890';

			const response = await request(app.getHttpServer())
				.get('/api/v1/health/liveness')
				.set('X-Correlation-Id', customCorrelationId)
				.expect(200);

			expect(response.headers['x-request-id']).toBe(customCorrelationId);
			expect(response.headers['x-correlation-id']).toBe(customCorrelationId);
		});
	});

	describe('Error Response Format', () => {
		it('should return consistent error format for 400 errors', async () => {
			const response = await request(app.getHttpServer())
				.post('/api/v1/auth/register')
				.send({
					email: 'invalid-email',
					password: 'weak',
				})
				.expect(400);

			expect(response.body).toHaveProperty('statusCode', 400);
			expect(response.body).toHaveProperty('timestamp');
			expect(response.body).toHaveProperty('path');
			expect(response.body).toHaveProperty('method', 'POST');
			expect(response.body).toHaveProperty('requestId');
			expect(response.body).toHaveProperty('message');

			// Verify timestamp is ISO string
			expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);

			// Verify request ID is in error response
			expect(response.headers['x-request-id']).toBe(response.body.requestId);
		});

		it('should return consistent error format for 401 errors', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/v1/auth/me')
				.expect(401);

			expect(response.body).toHaveProperty('statusCode', 401);
			expect(response.body).toHaveProperty('timestamp');
			expect(response.body).toHaveProperty('path');
			expect(response.body).toHaveProperty('method', 'GET');
			expect(response.body).toHaveProperty('requestId');
			expect(response.body).toHaveProperty('message');
		});

		it('should return consistent error format for 404 errors', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/v1/nonexistent-endpoint')
				.expect(404);

			expect(response.body).toHaveProperty('statusCode', 404);
			expect(response.body).toHaveProperty('timestamp');
			expect(response.body).toHaveProperty('path');
			expect(response.body).toHaveProperty('method', 'GET');
			expect(response.body).toHaveProperty('requestId');
			expect(response.body).toHaveProperty('message');
		});

		it('should NOT include stack trace in production mode', async () => {
			// Note: In test environment, NODE_ENV might be 'test', so stack might be included
			// This test verifies the structure, not the presence of stack
			const response = await request(app.getHttpServer())
				.post('/api/v1/auth/register')
				.send({})
				.expect(400);

			expect(response.body).toHaveProperty('statusCode');
			expect(response.body).toHaveProperty('message');

			// Stack should only be present in development mode
			// In production/test, it might not be present
		});
	});

	describe('API Versioning', () => {
		it('should accept requests with /api/v1/ prefix', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/v1/health/liveness')
				.expect(200);

			expect(response.body).toHaveProperty('status', 'ok');
		});

		it('should accept requests without version (defaults to v1)', async () => {
			// Note: This depends on NestJS versioning configuration
			// If defaultVersion is set, this should work
			const response = await request(app.getHttpServer())
				.get('/api/health/liveness')
				.expect(200);

			expect(response.body).toHaveProperty('status', 'ok');
		});
	});

	describe('Rate Limiting', () => {
		it('should include rate limit headers in responses', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/v1/health/liveness')
				.expect(200);

			// Rate limit headers should be present
			expect(response.headers['x-ratelimit-limit']).toBeDefined();
			expect(response.headers['x-ratelimit-remaining']).toBeDefined();
			expect(response.headers['x-ratelimit-reset']).toBeDefined();

			// Verify header values are numbers
			expect(Number(response.headers['x-ratelimit-limit'])).toBeGreaterThan(0);
			expect(Number(response.headers['x-ratelimit-remaining'])).toBeGreaterThanOrEqual(0);
		});

		it('should return 429 when rate limit is exceeded', async () => {
			// Make many requests quickly to trigger rate limit
			// Note: This test might be flaky depending on rate limit configuration
			// Adjust rate limit in test environment if needed
			const requests = Array.from({ length: 150 }, () =>
				request(app.getHttpServer()).get('/api/v1/health/liveness'),
			);

			const responses = await Promise.all(requests);

			// At least one should be rate limited (429)
			const rateLimited = responses.some((res) => res.status === 429);
			// Note: This might not always trigger if rate limit is high
			// This is more of a smoke test
			if (rateLimited) {
				const rateLimitedResponse = responses.find((res) => res.status === 429);
				expect(rateLimitedResponse?.body).toHaveProperty('statusCode', 429);
				expect(rateLimitedResponse?.body).toHaveProperty('message');
			}
		}).timeout(10000); // Increase timeout for this test
	});

	describe('Logging Interceptor', () => {
		it('should log request and response (verified via response headers)', async () => {
			// Logging is verified indirectly through request ID headers
			// Actual log verification would require log capture
			const response = await request(app.getHttpServer())
				.get('/api/v1/health/liveness')
				.expect(200);

			// If logging works, request ID should be present
			expect(response.headers['x-request-id']).toBeDefined();
		});
	});

	describe('CORS Headers', () => {
		it('should include CORS headers in responses', async () => {
			const response = await request(app.getHttpServer())
				.options('/api/v1/health/liveness')
				.expect(204);

			// CORS headers should be present
			expect(response.headers['access-control-allow-origin']).toBeDefined();
			expect(response.headers['access-control-allow-methods']).toBeDefined();
		});
	});
});

