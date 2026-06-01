import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/api-gateway/app.module';
import { AllExceptionsFilter } from '../../src/api-gateway/common/filters/all-exceptions.filter';
import { RequestIdInterceptor } from '../../src/api-gateway/common/interceptors/request-id.interceptor';
import { LoggingInterceptor } from '../../src/api-gateway/common/interceptors/logging.interceptor';

describe('Health Check API (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		
		// Set global prefix and versioning to match main.ts
		app.setGlobalPrefix('api');
		app.enableVersioning({
			type: VersioningType.URI,
			defaultVersion: '1',
		});
		
		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
			}),
		);
		
		// Add global exception filter and interceptors to match main.ts
		app.useGlobalFilters(new AllExceptionsFilter());
		app.useGlobalInterceptors(
			new RequestIdInterceptor(),
			new LoggingInterceptor(),
		);
		
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	describe('GET /health', () => {
		it('should return health status successfully (happy case)', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/v1/health')
				.expect((res) => {
					// Health check can return 200 (ok) or 503 (service unavailable)
					if (res.status !== 200 && res.status !== 503) {
						throw new Error(`Expected 200 or 503, got ${res.status}`);
					}
				});

			// If 503, check error response format; if 200, check health response format
			if (response.status === 503) {
				// Error response format from AllExceptionsFilter
				expect(response.body).toHaveProperty('statusCode', 503);
				expect(response.body).toHaveProperty('message');
				// Extract health status from message if available
				if (response.body.message?.status) {
					expect(['ok', 'error']).toContain(response.body.message.status);
				}
			} else {
				// Health response format from Terminus
				expect(response.body).toHaveProperty('status');
				expect(['ok', 'error']).toContain(response.body.status);
				expect(response.body).toHaveProperty('info');
				expect(response.body).toHaveProperty('error');
				expect(response.body).toHaveProperty('details');
			}

			// Check for request ID header
			expect(response.headers['x-request-id']).toBeDefined();
			expect(response.headers['x-correlation-id']).toBeDefined();
		});

		it('should include database health check', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/v1/health')
				.expect((res) => {
					if (res.status !== 200 && res.status !== 503) {
						throw new Error(`Expected 200 or 503, got ${res.status}`);
					}
				});

			// Extract health info from response
			// When 503, health response is in message object (from AllExceptionsFilter)
			// When 200, health response is directly in body
			const healthResponse = response.status === 503 
				? response.body.message 
				: response.body;

			// Health info can be in 'info' or 'details' field
			const healthInfo = healthResponse?.info || healthResponse?.details;

			expect(healthInfo).toBeDefined();
			expect(healthInfo).toHaveProperty('database');
			expect(healthInfo.database).toHaveProperty('status');
		});

		it('should include redis health check', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/v1/health')
				.expect((res) => {
					if (res.status !== 200 && res.status !== 503) {
						throw new Error(`Expected 200 or 503, got ${res.status}`);
					}
				});

			// Extract health info from response
			// When 503, health response is in message object (from AllExceptionsFilter)
			// When 200, health response is directly in body
			const healthResponse = response.status === 503 
				? response.body.message 
				: response.body;

			// Health info can be in 'info' or 'details' field
			const healthInfo = healthResponse?.info || healthResponse?.details;

			expect(healthInfo).toBeDefined();
			expect(healthInfo).toHaveProperty('redis');
			expect(healthInfo.redis).toHaveProperty('status');
		});
	});

	describe('GET /health/readiness', () => {
		it('should return readiness status successfully (happy case)', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/v1/health/readiness')
				.expect(200);

			expect(response.body).toHaveProperty('status');
			expect(['ok', 'error']).toContain(response.body.status);
			expect(response.body).toHaveProperty('info');
			expect(response.body.info).toHaveProperty('database');
			expect(response.body.info).toHaveProperty('redis');

			// Check for request ID header
			expect(response.headers['x-request-id']).toBeDefined();
		});
	});

	describe('GET /health/liveness', () => {
		it('should return liveness status successfully (happy case)', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/v1/health/liveness')
				.expect(200);

			expect(response.body).toHaveProperty('status', 'ok');
			expect(response.body).toHaveProperty('timestamp');
			expect(response.body).toHaveProperty('uptime');
			expect(typeof response.body.uptime).toBe('number');

			// Check for request ID header
			expect(response.headers['x-request-id']).toBeDefined();
		});
	});
});

