import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/api-gateway/app.module';
import {
  registerTestUser,
  loginTestUser,
  generateTestEmail,
  generateTestPhone,
  createAndLoginUser,
  expect200Or201,
} from '../helpers/test-helpers';

describe('Auth API (e2e)', () => {
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

  describe('POST /auth/register', () => {
    it('should register a new user successfully (happy case)', async () => {
      const email = generateTestEmail();
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullname: 'Test User',
          email,
          password: 'TestPassword123!',
          phone: generateTestPhone(),
        })
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', email);
      expect(response.body.user).toHaveProperty('fullname', 'Test User');
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should fail with invalid email (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullname: 'Test User',
          email: 'invalid-email',
          password: 'TestPassword123!',
          phone: generateTestPhone(),
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body.message).toBeDefined();
    });

    it('should fail with weak password (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullname: 'Test User',
          email: generateTestEmail(),
          password: 'weak',
          phone: generateTestPhone(),
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should fail with missing required fields (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: generateTestEmail(),
          // missing fullname, password, phone
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should fail with duplicate email (unhappy case)', async () => {
      const email = generateTestEmail();
      await registerTestUser(app, { email });

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullname: 'Another User',
          email,
          password: 'TestPassword123!',
          phone: generateTestPhone(),
        })
        .expect(409);

      expect(response.body).toHaveProperty('statusCode', 409);
    });
  });

  describe('POST /auth/login', () => {
    let testUser: { email: string; password: string };

    beforeAll(async () => {
      testUser = await registerTestUser(app);
    });

    it('should login successfully with valid credentials (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(expect200Or201());

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(typeof response.body.access_token).toBe('string');
      expect(response.body.access_token.length).toBeGreaterThan(0);
    });

    it('should fail with wrong password (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
    });

    it('should fail with non-existent email (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'TestPassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
    });

    it('should fail with missing email (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          password: 'TestPassword123!',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should fail with missing password (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('POST /auth/refresh', () => {
    let testUser: { userId: string; refreshToken: string };

    beforeAll(async () => {
      const user = await createAndLoginUser(app);
      testUser = {
        userId: user.userId || '',
        refreshToken: user.refreshToken || '',
      };
    });

    it('should refresh tokens successfully (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          userId: testUser.userId,
          refresh_token: testUser.refreshToken,
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body.access_token).not.toBe(testUser.refreshToken);
      expect(typeof response.body.access_token).toBe('string');
      expect(response.body.access_token.length).toBeGreaterThan(0);
    });

    it('should fail with invalid refresh token (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          userId: testUser.userId,
          refresh_token: 'invalid-token',
        })
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
    });

    it('should fail with missing userId (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refresh_token: testUser.refreshToken,
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should fail with invalid userId (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          userId: 'invalid-user-id',
          refresh_token: testUser.refreshToken,
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('POST /auth/logout', () => {
    let testUser: { userId: string };

    beforeAll(async () => {
      const user = await createAndLoginUser(app);
      testUser = { userId: user.userId || '' };
    });

    it('should logout successfully (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .send({
          userId: testUser.userId,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should fail with missing userId (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('GET /auth/me', () => {
    let accessToken: string;

    beforeAll(async () => {
      const user = await createAndLoginUser(app);
      accessToken = user.accessToken!;
    });

    it('should return user info with valid token (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('email');
    });

    it('should fail without token (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
    });

    it('should fail with invalid token (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
    });
  });
});

