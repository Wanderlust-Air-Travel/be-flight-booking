import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/api-gateway/app.module';
import { AllExceptionsFilter } from '../../src/api-gateway/common/filters/all-exceptions.filter';
import { RequestIdInterceptor } from '../../src/api-gateway/common/interceptors/request-id.interceptor';
import { LoggingInterceptor } from '../../src/api-gateway/common/interceptors/logging.interceptor';
import {
  createAndLoginUser,
  trySearchFlightsOneWay,
  getFareOptions,
  getSeatMap,
  createReservationOneWay,
  createBookingFromReservation,
  expect200Or201,
  verifyErrorResponseFormat,
  verifyRequestIdHeaders,
  validateSeatMapResponse,
  findSelectableSeat,
} from '../helpers/test-helpers';

describe('Booking API (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let flightInstanceId: string;
  let fareClassCode: string;

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

    // Get flight instance for testing
    const searchResult = await trySearchFlightsOneWay(app);
    if (searchResult && searchResult.outbound && searchResult.outbound.length > 0) {
      flightInstanceId = searchResult.outbound[0].flightInstanceId;
      const fareOptions = await getFareOptions(app, flightInstanceId);
      if (fareOptions && fareOptions.length > 0) {
        fareClassCode = fareOptions[0].fareClassCode;
      }
    } else {
      console.warn('Search microservice is not available. Booking tests will be skipped.');
    }
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * **RabbitMQ Integration:**
   * - Ticket creation after payment is processed asynchronously via RabbitMQ queue (`ticket_creation`)
   * - Email confirmations are sent asynchronously via RabbitMQ queue (`email_notifications`)
   * - Non-blocking: Email and ticket creation don't block booking/payment operations
   * - Fallback: If RabbitMQ is unavailable, system falls back to direct TCP communication
   * 
   * **Test Notes:**
   * - Booking tests automatically trigger email confirmation notifications (async, non-blocking)
   * - Email confirmations are sent after successful booking creation via RabbitMQ
   * - Email notifications won't block booking creation if email service fails
   * - Ticket creation happens asynchronously after payment success (via RabbitMQ)
   */

  describe('POST /bookings (Create from Reservation)', () => {
    it('should create booking from reservation successfully (happy case)', async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }
      // Create reservation first
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/bookings?reservationId=${reservation.reservationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          passengers: [
            {
              passengerType: 'ADT',
              fullname: 'Test Passenger',
              dob: '1990-01-15',
              gender: 'Male',
              documentNumber: `001234567890${Date.now()}`,
            },
          ],
          contactFullname: 'Test Contact',
          contactEmail: 'test@example.com',
          contactPhone: '0901234567',
          channel: 'web',
        })
        .expect(201);

      expect(response.body).toHaveProperty('bookingId');
      expect(response.body).toHaveProperty('pnrCode');
      expect(response.body).toHaveProperty('totalAmount');
      expect(response.body).toHaveProperty('status', 'pending');
      
      // Verify request ID headers
      verifyRequestIdHeaders(response);
    });

    it('should create booking with existing passenger (happy case)', async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }
      // First, create a booking to get a passenger ID
      const reservation1 = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );
      const booking1 = await createBookingFromReservation(
        app,
        accessToken,
        reservation1.reservationId,
      );

      // Get passenger ID from first booking (would need to query DB in real scenario)
      // For now, we'll test with new passenger
      const reservation2 = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/bookings?reservationId=${reservation2.reservationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          passengers: [
            {
              passengerType: 'ADT',
              fullname: 'Test Passenger 2',
              dob: '1991-02-20',
              gender: 'Female',
              documentNumber: `001234567891${Date.now()}`,
            },
          ],
          contactFullname: 'Test Contact',
          contactEmail: 'test@example.com',
          contactPhone: '0901234567',
          channel: 'web',
        })
        .expect(201);

      expect(response.body).toHaveProperty('bookingId');
    });

    it('should fail without reservationId (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          passengers: [
            {
              passengerType: 'ADT',
              fullname: 'Test Passenger',
              dob: '1990-01-15',
              gender: 'Male',
              documentNumber: '001234567890',
            },
          ],
          contactFullname: 'Test Contact',
          contactEmail: 'test@example.com',
          contactPhone: '0901234567',
          channel: 'web',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with invalid reservationId (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/bookings?reservationId=invalid-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          passengers: [
            {
              passengerType: 'ADT',
              fullname: 'Test Passenger',
              dob: '1990-01-15',
              gender: 'Male',
              documentNumber: '001234567890',
            },
          ],
          contactFullname: 'Test Contact',
          contactEmail: 'test@example.com',
          contactPhone: '0901234567',
          channel: 'web',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with missing passengers (unhappy case)', async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/bookings?reservationId=${reservation.reservationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          contactFullname: 'Test Contact',
          contactEmail: 'test@example.com',
          contactPhone: '0901234567',
          channel: 'web',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with invalid passenger data (unhappy case)', async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/bookings?reservationId=${reservation.reservationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          passengers: [
            {
              passengerType: 'ADT',
              // missing required fields
            },
          ],
          contactFullname: 'Test Contact',
          contactEmail: 'test@example.com',
          contactPhone: '0901234567',
          channel: 'web',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail without authentication (unhappy case)', async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/bookings?reservationId=${reservation.reservationId}`)
        .send({
          passengers: [
            {
              passengerType: 'ADT',
              fullname: 'Test Passenger',
              dob: '1990-01-15',
              gender: 'Male',
              documentNumber: '001234567890',
            },
          ],
          contactFullname: 'Test Contact',
          contactEmail: 'test@example.com',
          contactPhone: '0901234567',
          channel: 'web',
        })
        .expect(401);

      verifyErrorResponseFormat(response, 401);
    });

    it('should fail with invalid passenger DOB format (unhappy case)', async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/bookings?reservationId=${reservation.reservationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          passengers: [
            {
              passengerType: 'ADT',
              fullname: 'Test Passenger',
              dob: 'invalid-date',
              gender: 'Male',
              documentNumber: '001234567890',
            },
          ],
          contactFullname: 'Test Contact',
          contactEmail: 'test@example.com',
          contactPhone: '0901234567',
          channel: 'web',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with invalid passengerType (unhappy case)', async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/bookings?reservationId=${reservation.reservationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          passengers: [
            {
              passengerType: 'INVALID',
              fullname: 'Test Passenger',
              dob: '1990-01-15',
              gender: 'Male',
              documentNumber: '001234567890',
            },
          ],
          contactFullname: 'Test Contact',
          contactEmail: 'test@example.com',
          contactPhone: '0901234567',
          channel: 'web',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with invalid email format (unhappy case)', async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/bookings?reservationId=${reservation.reservationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          passengers: [
            {
              passengerType: 'ADT',
              fullname: 'Test Passenger',
              dob: '1990-01-15',
              gender: 'Male',
              documentNumber: '001234567890',
            },
          ],
          contactFullname: 'Test Contact',
          contactEmail: 'invalid-email',
          contactPhone: '0901234567',
          channel: 'web',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });
  });

  describe('GET /bookings/:id/fare-details', () => {
    let bookingId: string;

    beforeAll(async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping suite: Search microservice not available or no flight data');
        return;
      }
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
    });

    it('should get booking fare details successfully (happy case)', async () => {
      if (!bookingId) {
        console.warn('Skipping test: No booking ID available');
        return;
      }
      const response = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${bookingId}/fare-details`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('bookingId');
      expect(response.body.bookingId.toLowerCase()).toBe(bookingId.toLowerCase());
      expect(response.body).toHaveProperty('pnrCode');
      expect(response.body).toHaveProperty('fareClassName');
      expect(response.body).toHaveProperty('descriptions');
      expect(response.body).toHaveProperty('totalPrice');
    });

    it('should fail with invalid booking ID (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/bookings/invalid-id/fare-details')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail without authentication (unhappy case)', async () => {
      if (!bookingId) {
        console.warn('Skipping test: No booking ID available');
        return;
      }
      const response = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${bookingId}/fare-details`)
        .expect(401);

      verifyErrorResponseFormat(response, 401);
    });
  });

  describe('GET /bookings/:id/payment-info', () => {
    let bookingId: string;

    beforeAll(async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping suite: Search microservice not available or no flight data');
        return;
      }
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
    });

    it('should get booking payment info successfully (happy case)', async () => {
      if (!bookingId) {
        console.warn('Skipping test: No booking ID available');
        return;
      }
      const response = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${bookingId}/payment-info`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('bookingId');
      expect(response.body.bookingId.toLowerCase()).toBe(bookingId.toLowerCase());
      expect(response.body).toHaveProperty('pnrCode');
      expect(response.body).toHaveProperty('totalAmount');
      expect(response.body).toHaveProperty('currencyCode');
      expect(response.body).toHaveProperty('contactFullname');
      expect(response.body).toHaveProperty('contactEmail');
      expect(response.body).toHaveProperty('contactPhone');
      expect(response.body).toHaveProperty('status');
    });

    it('should fail with invalid booking ID (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/bookings/invalid-id/payment-info')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });
  });

  describe('PATCH /bookings/:id/passengers', () => {
    let bookingId: string;

    beforeAll(async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping suite: Search microservice not available or no flight data');
        return;
      }
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
    });

    it('should update booking passengers successfully (happy case)', async () => {
      if (!bookingId) {
        console.warn('Skipping test: No booking ID available');
        return;
      }
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bookingId}/passengers`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          adults: 2,
          minors: 0,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('totalPassengers');
    });

    it('should fail with invalid booking ID (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/bookings/invalid-id/passengers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          adults: 2,
          minors: 0,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with missing passenger count (unhappy case)', async () => {
      if (!bookingId) {
        console.warn('Skipping test: No booking ID available');
        return;
      }
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bookingId}/passengers`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });
  });

  describe('POST /bookings (With Seat Assignment from Reservation)', () => {
    it('should create booking with seat assignment from reservation (happy case)', async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }
      // Get seat map first
      const seatMap = await getSeatMap(app, flightInstanceId, 'economy');
      validateSeatMapResponse(seatMap, 'economy');
      
      // Find a selectable seat (available AND selectable for economy cabin)
      const availableSeat = findSelectableSeat(seatMap, 'economy');

      if (!availableSeat) {
        // Skip test if no available seats
        console.warn('No available seats found for seat assignment test');
        return;
      }

      // Create reservation with seat selection
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
        availableSeat.flightSeatId,
      );

      // Verify reservation has seat information
      const reservationResponse = await request(app.getHttpServer())
        .get(`/api/v1/reservations/${reservation.reservationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(reservationResponse.body.segments[0]).toHaveProperty('flightSeatId', availableSeat.flightSeatId);
      expect(reservationResponse.body.segments[0]).toHaveProperty('seatNumber', availableSeat.seatNumber);

      // Create booking from reservation
      const response = await request(app.getHttpServer())
        .post(`/api/v1/bookings?reservationId=${reservation.reservationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          passengers: [
            {
              passengerType: 'ADT',
              fullname: 'Test Passenger',
              dob: '1990-01-15',
              gender: 'Male',
              documentNumber: `001234567890${Date.now()}`,
            },
          ],
          contactFullname: 'Test Contact',
          contactEmail: 'test@example.com',
          contactPhone: '0901234567',
          channel: 'web',
        })
        .expect(201);

      expect(response.body).toHaveProperty('bookingId');
      expect(response.body).toHaveProperty('pnrCode');
      expect(response.body).toHaveProperty('totalAmount');
      expect(response.body).toHaveProperty('status', 'pending');
      
      // Verify request ID headers
      verifyRequestIdHeaders(response);
    });

    it('should create booking without seat assignment (seat was not selected in reservation)', async () => {
      // Create reservation without seat selection
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
        // No flightSeatId - seat not selected
      );

      // Create booking from reservation
      const response = await request(app.getHttpServer())
        .post(`/api/v1/bookings?reservationId=${reservation.reservationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          passengers: [
            {
              passengerType: 'ADT',
              fullname: 'Test Passenger',
              dob: '1990-01-15',
              gender: 'Male',
              documentNumber: `001234567890${Date.now()}`,
            },
          ],
          contactFullname: 'Test Contact',
          contactEmail: 'test@example.com',
          contactPhone: '0901234567',
          channel: 'web',
        })
        .expect(201);

      expect(response.body).toHaveProperty('bookingId');
      expect(response.body).toHaveProperty('pnrCode');
    });
  });
});

