import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/api-gateway/app.module';

describe('Health Check API (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	describe('GET /health', () => {
		it('should return health status successfully (happy case)', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/v1/health')
				.expect(200);

			expect(response.body).toHaveProperty('status');
			expect(['ok', 'error']).toContain(response.body.status);
			expect(response.body).toHaveProperty('info');
			expect(response.body).toHaveProperty('error');
			expect(response.body).toHaveProperty('details');

			// Check for request ID header
			expect(response.headers['x-request-id']).toBeDefined();
			expect(response.headers['x-correlation-id']).toBeDefined();
		});

		it('should include database health check', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/v1/health')
				.expect(200);

			expect(response.body.info).toHaveProperty('database');
			expect(response.body.info.database).toHaveProperty('status');
		});

		it('should include redis health check', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/v1/health')
				.expect(200);

			expect(response.body.info).toHaveProperty('redis');
			expect(response.body.info.redis).toHaveProperty('status');
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

