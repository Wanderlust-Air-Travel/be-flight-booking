import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/api-gateway/app.module';
import { AllExceptionsFilter } from '../../src/api-gateway/common/filters/all-exceptions.filter';
import { RequestIdInterceptor } from '../../src/api-gateway/common/interceptors/request-id.interceptor';
import { LoggingInterceptor } from '../../src/api-gateway/common/interceptors/logging.interceptor';
import { randomUUID } from 'crypto';
import {
  createAndLoginUser,
  searchFlightsOneWay,
  trySearchFlightsOneWay,
  getFareOptions,
  createReservationOneWay,
  createBookingFromReservation,
  processPayment,
  expect200Or201,
  verifyErrorResponseFormat,
  verifyRequestIdHeaders,
} from '../helpers/test-helpers';

describe('Payment API (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let bookingId: string | undefined;
  let totalAmount: number | undefined;
  let microservicesAvailable = true;

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

    // Setup test data
    const user = await createAndLoginUser(app);
    accessToken = user.accessToken!;

    // Create a booking for testing
    const searchResult = await trySearchFlightsOneWay(app);
    if (searchResult && searchResult.outbound && searchResult.outbound.length > 0) {
      const flightInstanceId = searchResult.outbound[0].flightInstanceId;
      const fareOptions = await getFareOptions(app, flightInstanceId);
      if (fareOptions && fareOptions.length > 0) {
        const fareClassCode = fareOptions[0].fareClassCode;
        const reservation = await createReservationOneWay(
          app,
          accessToken,
          flightInstanceId,
          fareClassCode,
        );
        const booking = await createBookingFromReservation(
          app,
          accessToken,
          reservation.reservationId,
        );
        bookingId = booking.bookingId;
        totalAmount = booking.totalAmount;
      }
    } else {
      microservicesAvailable = false;
      console.warn(
        'Search microservice is not running. Payment tests will be skipped.',
      );
      console.warn(
        '   Please start microservices with: docker-compose -f docker-compose-full-services.yml up -d',
      );
    }
  });

  afterAll(async () => {
    await app.close();
  });

  // Skip all tests if microservices are not available
  const describeOrSkip = microservicesAvailable ? describe : describe.skip;

  describeOrSkip('POST /payments/bookings/:bookingId/process', () => {
    it('should process payment successfully (happy case)', async () => {
      // Create a new booking for this test
      const searchResult = await searchFlightsOneWay(app);
      const flightInstanceId = searchResult.outbound[0].flightInstanceId;
      const fareOptions = await getFareOptions(app, flightInstanceId);
      const fareClassCode = fareOptions[0].fareClassCode;
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );
      const booking = await createBookingFromReservation(
        app,
        accessToken,
        reservation.reservationId,
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.bookingId}/process`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          paymentMethodCode: 'CREDIT_CARD',
          transactionRef: `TXN${Date.now()}`,
          idempotencyKey: `idempotency-${randomUUID()}`,
          amount: booking.totalAmount,
        })
        .expect(200);

      expect(response.body).toHaveProperty('paymentId');
      expect(response.body).toHaveProperty('bookingId', booking.bookingId);
      expect(response.body).toHaveProperty('amount', booking.totalAmount);
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('paymentMethodCode', 'CREDIT_CARD');
      expect(response.body).toHaveProperty('transactionRef');
      
      // Verify request ID headers
      verifyRequestIdHeaders(response);
    });

    it('should handle idempotency key correctly (happy case)', async () => {
      // Create a new booking
      const searchResult = await searchFlightsOneWay(app);
      const flightInstanceId = searchResult.outbound[0].flightInstanceId;
      const fareOptions = await getFareOptions(app, flightInstanceId);
      const fareClassCode = fareOptions[0].fareClassCode;
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );
      const booking = await createBookingFromReservation(
        app,
        accessToken,
        reservation.reservationId,
      );

      const idempotencyKey = `idempotency-${randomUUID()}`;

      // First request
      const response1 = await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.bookingId}/process`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          paymentMethodCode: 'CREDIT_CARD',
          transactionRef: `TXN${Date.now()}`,
          idempotencyKey,
          amount: booking.totalAmount,
        })
        .expect(200);

      // Second request with same idempotency key
      const response2 = await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.bookingId}/process`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          paymentMethodCode: 'CREDIT_CARD',
          transactionRef: `TXN${Date.now()}`,
          idempotencyKey,
          amount: booking.totalAmount,
        })
        .expect(200);

      // Should return the same payment
      expect(response1.body.paymentId).toBe(response2.body.paymentId);
      expect(response1.body.amount).toBe(response2.body.amount);
      expect(response1.body.status).toBe(response2.body.status);
      
      // Verify request ID headers for both requests
      verifyRequestIdHeaders(response1);
      verifyRequestIdHeaders(response2);
    });

    it('should fail with wrong amount (unhappy case)', async () => {
      const searchResult = await searchFlightsOneWay(app);
      const flightInstanceId = searchResult.outbound[0].flightInstanceId;
      const fareOptions = await getFareOptions(app, flightInstanceId);
      const fareClassCode = fareOptions[0].fareClassCode;
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );
      const booking = await createBookingFromReservation(
        app,
        accessToken,
        reservation.reservationId,
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.bookingId}/process`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          paymentMethodCode: 'CREDIT_CARD',
          transactionRef: `TXN${Date.now()}`,
          idempotencyKey: `idempotency-${randomUUID()}`,
          amount: booking.totalAmount + 1000, // Wrong amount
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with invalid booking ID (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payments/bookings/invalid-id/process')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          paymentMethodCode: 'CREDIT_CARD',
          transactionRef: `TXN${Date.now()}`,
          idempotencyKey: `idempotency-${randomUUID()}`,
          amount: 1000000,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail without authentication (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${bookingId}/process`)
        .send({
          paymentMethodCode: 'CREDIT_CARD',
          transactionRef: `TXN${Date.now()}`,
          idempotencyKey: `idempotency-${randomUUID()}`,
          amount: totalAmount,
        })
        .expect(401);

      verifyErrorResponseFormat(response, 401);
    });

    it('should fail with missing required fields (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${bookingId}/process`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          // missing paymentMethodCode, amount, etc.
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with invalid payment method code (unhappy case)', async () => {
      const searchResult = await searchFlightsOneWay(app);
      const flightInstanceId = searchResult.outbound[0].flightInstanceId;
      const fareOptions = await getFareOptions(app, flightInstanceId);
      const fareClassCode = fareOptions[0].fareClassCode;
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );
      const booking = await createBookingFromReservation(
        app,
        accessToken,
        reservation.reservationId,
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.bookingId}/process`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          paymentMethodCode: 'INVALID_METHOD',
          transactionRef: `TXN${Date.now()}`,
          idempotencyKey: `idempotency-${randomUUID()}`,
          amount: booking.totalAmount,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with zero amount (unhappy case)', async () => {
      const searchResult = await searchFlightsOneWay(app);
      const flightInstanceId = searchResult.outbound[0].flightInstanceId;
      const fareOptions = await getFareOptions(app, flightInstanceId);
      const fareClassCode = fareOptions[0].fareClassCode;
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );
      const booking = await createBookingFromReservation(
        app,
        accessToken,
        reservation.reservationId,
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.bookingId}/process`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          paymentMethodCode: 'CREDIT_CARD',
          transactionRef: `TXN${Date.now()}`,
          idempotencyKey: `idempotency-${randomUUID()}`,
          amount: 0,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with negative amount (unhappy case)', async () => {
      const searchResult = await searchFlightsOneWay(app);
      const flightInstanceId = searchResult.outbound[0].flightInstanceId;
      const fareOptions = await getFareOptions(app, flightInstanceId);
      const fareClassCode = fareOptions[0].fareClassCode;
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );
      const booking = await createBookingFromReservation(
        app,
        accessToken,
        reservation.reservationId,
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.bookingId}/process`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          paymentMethodCode: 'CREDIT_CARD',
          transactionRef: `TXN${Date.now()}`,
          idempotencyKey: `idempotency-${randomUUID()}`,
          amount: -1000,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });
  });

  describe('POST /payments/bookings/:bookingId', () => {
    it('should create payment successfully (happy case)', async () => {
      const searchResult = await searchFlightsOneWay(app);
      const flightInstanceId = searchResult.outbound[0].flightInstanceId;
      const fareOptions = await getFareOptions(app, flightInstanceId);
      const fareClassCode = fareOptions[0].fareClassCode;
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );
      const booking = await createBookingFromReservation(
        app,
        accessToken,
        reservation.reservationId,
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.bookingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          paymentMethodCode: 'CREDIT_CARD',
          transactionRef: `TXN${Date.now()}`,
          amount: booking.totalAmount,
        })
        .expect(200);

      expect(response.body).toHaveProperty('paymentId');
      expect(response.body).toHaveProperty('bookingId', booking.bookingId);
      expect(response.body).toHaveProperty('pnrCode');
      expect(response.body).toHaveProperty('amount', booking.totalAmount);
      expect(response.body).toHaveProperty('currencyCode');
      expect(response.body).toHaveProperty('paymentMethodCode', 'CREDIT_CARD');
      expect(response.body).toHaveProperty('paymentMethodName');
      expect(response.body).toHaveProperty('status', 'pending');
      expect(response.body).toHaveProperty('transactionRef');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('paidAt');
      
      // Verify request ID headers
      verifyRequestIdHeaders(response);
    });

    it('should fail with invalid booking ID (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payments/bookings/invalid-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          paymentMethodCode: 'CREDIT_CARD',
          transactionRef: `TXN${Date.now()}`,
          amount: 1000000,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail without authentication (unhappy case)', async () => {
      const searchResult = await searchFlightsOneWay(app);
      const flightInstanceId = searchResult.outbound[0].flightInstanceId;
      const fareOptions = await getFareOptions(app, flightInstanceId);
      const fareClassCode = fareOptions[0].fareClassCode;
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );
      const booking = await createBookingFromReservation(
        app,
        accessToken,
        reservation.reservationId,
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.bookingId}`)
        .send({
          paymentMethodCode: 'CREDIT_CARD',
          transactionRef: `TXN${Date.now()}`,
          amount: booking.totalAmount,
        })
        .expect(401);

      verifyErrorResponseFormat(response, 401);
    });
  });

  describeOrSkip('GET /payments/:id', () => {
    let paymentId: string;

    beforeAll(async () => {
      if (!bookingId || !totalAmount) {
        throw new Error('bookingId and totalAmount must be set');
      }
      const payment = await processPayment(app, accessToken, bookingId, totalAmount);
      paymentId = payment.paymentId;
    });

    it('should get payment by ID successfully (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('paymentId', paymentId);
      expect(response.body).toHaveProperty('bookingId');
      expect(response.body).toHaveProperty('pnrCode');
      expect(response.body).toHaveProperty('amount');
      expect(response.body).toHaveProperty('currencyCode');
      expect(response.body).toHaveProperty('paymentMethodCode');
      expect(response.body).toHaveProperty('paymentMethodName');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('transactionRef');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('paidAt');
      expect(['pending', 'success', 'failed']).toContain(response.body.status);
      
      // Verify request ID headers
      verifyRequestIdHeaders(response);
    });

    it('should fail with invalid payment ID (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/payments/invalid-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });
  });

  describeOrSkip('GET /payments/bookings/:bookingId', () => {
    it('should get payments by booking ID successfully (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/payments/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        const payment = response.body[0];
        expect(payment).toHaveProperty('paymentId');
        expect(payment).toHaveProperty('bookingId', bookingId);
        expect(payment).toHaveProperty('pnrCode');
        expect(payment).toHaveProperty('amount');
        expect(payment).toHaveProperty('currencyCode');
        expect(payment).toHaveProperty('paymentMethodCode');
        expect(payment).toHaveProperty('paymentMethodName');
        expect(payment).toHaveProperty('status');
        expect(['pending', 'success', 'failed']).toContain(payment.status);
        expect(payment).toHaveProperty('transactionRef');
        expect(payment).toHaveProperty('createdAt');
        expect(payment).toHaveProperty('paidAt');
      }
      
      // Verify request ID headers
      verifyRequestIdHeaders(response);
    });
    
    it('should fail with invalid booking ID (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/payments/bookings/invalid-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });
    
    it('should fail without authentication (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/payments/bookings/${bookingId}`)
        .expect(401);

      verifyErrorResponseFormat(response, 401);
    });
  });

  describeOrSkip('PATCH /payments/:id/status', () => {
    let paymentId: string;

    beforeAll(async () => {
      if (!bookingId || !totalAmount) {
        throw new Error('bookingId and totalAmount must be set');
      }
      const payment = await processPayment(app, accessToken, bookingId, totalAmount);
      paymentId = payment.paymentId;
    });

    it('should update payment status successfully (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/payments/${paymentId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'failed',
          reason: 'Payment gateway error',
        })
        .expect(200);

      expect(response.body).toHaveProperty('paymentId', paymentId);
      expect(response.body).toHaveProperty('bookingId');
      expect(response.body).toHaveProperty('status', 'failed');
      expect(response.body).toHaveProperty('amount');
      expect(response.body).toHaveProperty('currencyCode');
      expect(response.body).toHaveProperty('paymentMethodCode');
      expect(response.body).toHaveProperty('paymentMethodName');
      
      // Verify request ID headers
      verifyRequestIdHeaders(response);
    });

    it('should fail with invalid status (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/payments/${paymentId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'invalid-status',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail without authentication (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/payments/${paymentId}/status`)
        .send({
          status: 'failed',
          reason: 'Test reason',
        })
        .expect(401);

      verifyErrorResponseFormat(response, 401);
    });

    it('should fail with invalid payment ID (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/payments/invalid-id/status')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'failed',
          reason: 'Test reason',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });
  });

  describe('POST /payments/webhooks/:gateway', () => {
    // Webhook tests don't require bookingId, so we don't skip them
    it('should handle webhook successfully (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payments/webhooks/mock')
        .set('x-signature', 'test-signature')
        .send({
          transactionId: `TXN${Date.now()}`,
          status: 'success',
          amount: 1000000,
          currency: 'VND',
          message: 'Payment processed successfully',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle webhook without signature (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payments/webhooks/mock')
        .send({
          transactionId: `TXN${Date.now()}`,
          status: 'success',
          amount: 1000000,
          currency: 'VND',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should fail with invalid gateway (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payments/webhooks/invalid-gateway')
        .send({
          transactionId: `TXN${Date.now()}`,
          status: 'success',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should handle webhook with missing payload (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/payments/webhooks/mock')
        .send({})
        .expect(200);

      // Webhook might still return 200 but process with empty payload
      expect(response.body).toHaveProperty('success');
    });
  });
});

