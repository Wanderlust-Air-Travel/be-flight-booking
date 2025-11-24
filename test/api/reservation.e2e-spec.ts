import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/api-gateway/app.module';
import { AllExceptionsFilter } from '../../src/api-gateway/common/filters/all-exceptions.filter';
import { RequestIdInterceptor } from '../../src/api-gateway/common/interceptors/request-id.interceptor';
import { LoggingInterceptor } from '../../src/api-gateway/common/interceptors/logging.interceptor';
import {
  createAndLoginUser,
  searchFlightsOneWay,
  trySearchFlightsOneWay,
  searchFlightsRoundTrip,
  getFareOptions,
  getSeatMap,
  createReservationOneWay,
  expect200Or201,
  verifyErrorResponseFormat,
  verifyRequestIdHeaders,
  saveCabinSelection,
  saveSeatSelection,
  validateSeatMapResponse,
  findSelectableSeat,
} from '../helpers/test-helpers';

describe('Reservation API (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let flightInstanceId: string | undefined;
  let returnFlightInstanceId: string | undefined;
  let fareClassCode: string | undefined;

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
    // Use trySearchFlightsOneWay to handle microservice connection errors gracefully
    const searchResult = await trySearchFlightsOneWay(app);
    if (!searchResult) {
      console.warn('Search microservice is not available. Some reservation tests may be skipped.');
    } else if (searchResult.outbound && searchResult.outbound.length > 0) {
      flightInstanceId = searchResult.outbound[0].flightInstanceId;
      if (flightInstanceId) {
        const fareOptions = await getFareOptions(app, flightInstanceId);
        if (fareOptions && fareOptions.length > 0) {
          fareClassCode = fareOptions[0].fareClassCode;
        }
      }
    }

    // Get return flight for round-trip
    if (searchResult) {
      try {
        const roundTripResult = await searchFlightsRoundTrip(app);
        if (roundTripResult.inbound && roundTripResult.inbound.length > 0) {
          returnFlightInstanceId = roundTripResult.inbound[0].flightInstanceId;
        }
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        if (
          errorMessage.includes('Connection closed') ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('Search microservice')
        ) {
          console.warn('Search microservice not available for round-trip search');
        } else {
          throw error;
        }
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /reservations (One-Way)', () => {
    it('should create reservation one-way successfully (happy case)', async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }

      // New flow: Must save cabin and seat to booking state first
      // Step 1: Save cabin selection
      await saveCabinSelection(app, accessToken, flightInstanceId, 'economy', fareClassCode);

      // Step 2: Get available seat and save seat selection
      const seatMap = await getSeatMap(app, flightInstanceId, 'economy');
      validateSeatMapResponse(seatMap, 'economy');
      
      // Find selectable seat (available AND selectable for economy cabin)
      const availableSeat = findSelectableSeat(seatMap, 'economy');

      if (availableSeat) {
        await saveSeatSelection(
          app,
          accessToken,
          flightInstanceId,
          availableSeat.flightSeatId,
          availableSeat.seatNumber,
        );
      }

      // Step 3: Create reservation (backend gets cabin + seat from Redis)
      const response = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId,
              segmentType: 'outbound',
              // No fareClassCode or flightSeatId - backend gets from Redis
            },
          ],
          numberOfPassengers: 1,
          currencyCode: 'VND',
        })
        .expect(expect200Or201());

      expect(response.body).toHaveProperty('reservationId');
      expect(response.body).toHaveProperty('reservationCode');
      expect(response.body).toHaveProperty('totalAmount');
      expect(response.body).toHaveProperty('status', 'active');
      expect(response.body).toHaveProperty('expiresAt');
      expect(response.body).toHaveProperty('segments');
      expect(Array.isArray(response.body.segments)).toBe(true);
      expect(response.body.segments.length).toBe(1);

      // Verify request ID headers
      verifyRequestIdHeaders(response);
    });

    it('should fail without authentication (unhappy case)', async () => {
      // Use mock UUID v7 if flightInstanceId is not available
      const mockFlightInstanceId = flightInstanceId || '019a8f4a-bb0e-7402-a0c4-27647b89dc71';

      const response = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .send({
          segments: [
            {
              flightInstanceId: mockFlightInstanceId,
              segmentType: 'outbound',
            },
          ],
          numberOfPassengers: 1,
          currencyCode: 'VND',
        })
        .expect(401);

      verifyErrorResponseFormat(response, 401);
    });

    it('should fail with missing segments (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          numberOfPassengers: 1,
          currencyCode: 'VND',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with invalid flightInstanceId (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId: 'invalid-id',
              segmentType: 'outbound',
            },
          ],
          numberOfPassengers: 1,
          currencyCode: 'VND',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail without cabin and seat selection (unhappy case)', async () => {
      // Use mock UUID v7 if flightInstanceId is not available
      const mockFlightInstanceId = flightInstanceId || '019a8f4a-bb0e-7402-a0c4-27647b89dc71';

      // Try to create reservation without saving cabin/seat first
      const response = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId: mockFlightInstanceId,
              segmentType: 'outbound',
            },
          ],
          numberOfPassengers: 1,
          currencyCode: 'VND',
        });

      // Handle both business logic errors (400) and infrastructure errors (503)
      if (response.status === 503) {
        // Reservation microservice is not running - skip this test
        console.warn('Skipping test: Reservation microservice is not available');
        verifyErrorResponseFormat(response, 503);
        return;
      }

      // Business logic error - should be 400 with cabin/seat error message
      expect(response.status).toBe(400);
      verifyErrorResponseFormat(response, 400);
      
      // Error message should indicate missing cabin/seat selection
      const errorMessage = Array.isArray(response.body.message) 
        ? response.body.message.join(' ') 
        : response.body.message;
      expect(errorMessage).toMatch(/cabin|seat|booking state/i);
    });

    it('should fail with zero passengers (unhappy case)', async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }

      // Save cabin and seat first
      await saveCabinSelection(app, accessToken, flightInstanceId, 'economy', fareClassCode);
      const seatMap = await getSeatMap(app, flightInstanceId, 'economy');
      validateSeatMapResponse(seatMap, 'economy');
      
      const availableSeat = findSelectableSeat(seatMap, 'economy');
      if (availableSeat) {
        await saveSeatSelection(app, accessToken, flightInstanceId, availableSeat.flightSeatId, availableSeat.seatNumber);
      }

      const response = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId,
              segmentType: 'outbound',
            },
          ],
          numberOfPassengers: 0,
          currencyCode: 'VND',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should create reservation without currencyCode (currencyCode is optional)', async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }

      // Save cabin and seat first
      await saveCabinSelection(app, accessToken, flightInstanceId, 'economy', fareClassCode);
      const seatMap = await getSeatMap(app, flightInstanceId, 'economy');
      let availableSeat: any = null;
      if (seatMap.seats && seatMap.seats.length > 0) {
        for (const group of seatMap.seats) {
          if (group.list && group.list.length > 0) {
            availableSeat = group.list.find((seat: any) => seat.isAvailable === true);
            if (availableSeat) break;
          }
        }
      }

      if (availableSeat) {
        await saveSeatSelection(app, accessToken, flightInstanceId, availableSeat.flightSeatId, availableSeat.seatNumber);
      }

      const response = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId,
              segmentType: 'outbound',
            },
          ],
          numberOfPassengers: 1,
        })
        .expect(expect200Or201());

      expect(response.body).toHaveProperty('reservationId');
      expect(response.body).toHaveProperty('reservationCode');
    });

    it('should fail with empty segments array (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [],
          numberOfPassengers: 1,
          currencyCode: 'VND',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with invalid segmentType (unhappy case)', async () => {
      // Use mock UUID v7 if flightInstanceId is not available
      const mockFlightInstanceId = flightInstanceId || '019a8f4a-bb0e-7402-a0c4-27647b89dc71';

      const response = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId: mockFlightInstanceId,
              segmentType: 'invalid_type',
            },
          ],
          numberOfPassengers: 1,
          currencyCode: 'VND',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });
  });

  describe('POST /reservations (Round-Trip)', () => {
    it('should create reservation round-trip successfully (happy case)', async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }

      // New flow: Save cabin and seat for both flights
      // Outbound flight
      await request(app.getHttpServer())
        .post('/api/v1/booking-state/cabin')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          flightInstanceId,
          cabinType: 'economy',
          fareClassCode,
        })
        .expect(expect200Or201());

      const outboundSeatMap = await getSeatMap(app, flightInstanceId, 'economy');
      validateSeatMapResponse(outboundSeatMap, 'economy');
      const outboundSeat = findSelectableSeat(outboundSeatMap, 'economy');

      if (outboundSeat) {
        await request(app.getHttpServer())
          .post('/api/v1/booking-state/seat')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            flightInstanceId,
            flightSeatId: outboundSeat.flightSeatId,
            seatNumber: outboundSeat.seatNumber,
          })
          .expect(expect200Or201());
      }

      // Inbound flight
      if (!returnFlightInstanceId) {
        console.warn('Skipping test: No return flight instance ID available');
        return;
      }

      await request(app.getHttpServer())
        .post('/api/v1/booking-state/cabin')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          flightInstanceId: returnFlightInstanceId,
          cabinType: 'economy',
          fareClassCode,
        })
        .expect(expect200Or201());

      const inboundSeatMap = await getSeatMap(app, returnFlightInstanceId, 'economy');
      validateSeatMapResponse(inboundSeatMap, 'economy');
      const inboundSeat = findSelectableSeat(inboundSeatMap, 'economy');

      if (inboundSeat) {
        await request(app.getHttpServer())
          .post('/api/v1/booking-state/seat')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            flightInstanceId: returnFlightInstanceId,
            flightSeatId: inboundSeat.flightSeatId,
            seatNumber: inboundSeat.seatNumber,
          })
          .expect(expect200Or201());
      }

      // Create reservation (backend gets cabin + seat from Redis for each flight)
      const response = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId,
              segmentType: 'outbound',
            },
            {
              flightInstanceId: returnFlightInstanceId,
              segmentType: 'inbound',
            },
          ],
          numberOfPassengers: 1,
          currencyCode: 'VND',
        })
        .expect(expect200Or201());

      expect(response.body).toHaveProperty('reservationId');
      expect(response.body).toHaveProperty('reservationCode');
      expect(response.body).toHaveProperty('totalAmount');
      expect(response.body).toHaveProperty('segments');
      expect(response.body.segments.length).toBe(2);
      expect(response.body.totalAmount).toBeGreaterThan(0);
    });

    it('should fail with invalid return flightInstanceId (unhappy case)', async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }

      // Save cabin and seat for outbound first
      await request(app.getHttpServer())
        .post('/api/v1/booking-state/cabin')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          flightInstanceId,
          cabinType: 'economy',
          fareClassCode,
        })
        .expect(expect200Or201());

      const seatMap = await getSeatMap(app, flightInstanceId, 'economy');
      let availableSeat: any = null;
      if (seatMap.seats && seatMap.seats.length > 0) {
        for (const group of seatMap.seats) {
          if (group.list && group.list.length > 0) {
            availableSeat = group.list.find((seat: any) => seat.isAvailable === true);
            if (availableSeat) break;
          }
        }
      }

      if (availableSeat) {
        await request(app.getHttpServer())
          .post('/api/v1/booking-state/seat')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            flightInstanceId,
            flightSeatId: availableSeat.flightSeatId,
            seatNumber: availableSeat.seatNumber,
          })
          .expect(expect200Or201());
      }

      const response = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId,
              segmentType: 'outbound',
            },
            {
              flightInstanceId: 'invalid-return-id',
              segmentType: 'inbound',
            },
          ],
          numberOfPassengers: 1,
          currencyCode: 'VND',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });
  });

  describe('GET /reservations', () => {
    it('should list reservations successfully (happy case)', async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }

      // Create a reservation first
      await createReservationOneWay(app, accessToken, flightInstanceId, fareClassCode);

      const response = await request(app.getHttpServer())
        .get('/api/v1/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should fail without authentication (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reservations')
        .expect(401);

      verifyErrorResponseFormat(response, 401);
    });
  });

  describe('GET /reservations/:id', () => {
    let reservationId: string;

    beforeAll(async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test suite: Search microservice not available or no flight data');
        return;
      }

      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );
      reservationId = reservation.reservationId;
    });

    it('should get reservation by ID successfully (happy case)', async () => {
      if (!reservationId) {
        console.warn('Skipping test: No reservation ID available');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/api/v1/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('reservationId', reservationId);
      expect(response.body).toHaveProperty('reservationCode');
      expect(response.body).toHaveProperty('totalAmount');
    });

    it('should fail with invalid reservation ID (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reservations/invalid-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });
  });

  describe('GET /reservations/code/:code', () => {
    let reservationCode: string;

    beforeAll(async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test suite: Search microservice not available or no flight data');
        return;
      }

      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );
      reservationCode = reservation.reservationCode;
    });

    it('should get reservation by code successfully (happy case)', async () => {
      if (!reservationCode) {
        console.warn('Skipping test: No reservation code available');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/api/v1/reservations/code/${reservationCode}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('reservationCode', reservationCode);
      expect(response.body).toHaveProperty('reservationId');
    });

    it('should fail with invalid reservation code (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reservations/code/INVALID')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });
  });

  describe('POST /reservations/:id/cancel', () => {
    let reservationId: string;

    beforeEach(async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test setup: Search microservice not available or no flight data');
        return;
      }

      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );
      reservationId = reservation.reservationId;
    });

    it('should cancel reservation successfully (happy case)', async () => {
      if (!reservationId) {
        console.warn('Skipping test: No reservation ID available');
        return;
      }

      const response = await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservationId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should fail with invalid reservation ID (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/reservations/invalid-id/cancel')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail when canceling already cancelled reservation (unhappy case)', async () => {
      if (!reservationId) {
        console.warn('Skipping test: No reservation ID available');
        return;
      }

      // Cancel first time
      await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservationId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Try to cancel again
      const response = await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservationId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });
  });

  describe('POST /reservations/:id/extend', () => {
    let reservationId: string;

    beforeEach(async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test setup: Search microservice not available or no flight data');
        return;
      }

      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );
      reservationId = reservation.reservationId;
    });

    it('should extend reservation successfully (happy case)', async () => {
      if (!reservationId || !flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: No reservation ID available or Search microservice not available');
        return;
      }

      const response = await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservationId}/extend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          additionalSeconds: 600,
        })
        .expect(expect200Or201());

      expect(response.body).toHaveProperty('reservationId', reservationId);
      expect(response.body).toHaveProperty('expiresAt');
      expect(response.body).toHaveProperty('ttl');
    });

    it('should fail with invalid additionalSeconds (unhappy case)', async () => {
      if (!reservationId || !flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: No reservation ID available or Search microservice not available');
        return;
      }

      const response = await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservationId}/extend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          additionalSeconds: -100,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with missing additionalSeconds (unhappy case)', async () => {
      if (!reservationId || !flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: No reservation ID available or Search microservice not available');
        return;
      }

      const response = await request(app.getHttpServer())
        .post(`/api/v1/reservations/${reservationId}/extend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });
  });

  describe('POST /reservations (With Seat Selection)', () => {
    it('should create reservation with seat selection successfully (happy case)', async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }

      // New flow: Save cabin and seat to booking state first
      await request(app.getHttpServer())
        .post('/api/v1/booking-state/cabin')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          flightInstanceId,
          cabinType: 'economy',
          fareClassCode,
        })
        .expect(expect200Or201());

      // Get seat map and find available seat
      const seatMap = await getSeatMap(app, flightInstanceId, 'economy');
      validateSeatMapResponse(seatMap, 'economy');
      const availableSeat = findSelectableSeat(seatMap, 'economy');

      if (!availableSeat) {
        console.warn('No selectable seats found for seat selection test');
        return;
      }

      // Save seat selection
      await request(app.getHttpServer())
        .post('/api/v1/booking-state/seat')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          flightInstanceId,
          flightSeatId: availableSeat.flightSeatId,
          seatNumber: availableSeat.seatNumber,
        })
        .expect(expect200Or201());

      // Create reservation (backend gets cabin + seat from Redis)
      const response = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId,
              segmentType: 'outbound',
              // No fareClassCode or flightSeatId - backend gets from Redis
            },
          ],
          numberOfPassengers: 1,
          currencyCode: 'VND',
        })
        .expect(expect200Or201());

      expect(response.body).toHaveProperty('reservationId');
      expect(response.body).toHaveProperty('reservationCode');
      expect(response.body).toHaveProperty('segments');
      expect(response.body.segments.length).toBe(1);
      expect(response.body.segments[0]).toHaveProperty('flightSeatId', availableSeat.flightSeatId);
      expect(response.body.segments[0]).toHaveProperty('seatNumber', availableSeat.seatNumber);
    });

    it('should fail with invalid seat selection in booking state (unhappy case)', async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }

      // Save cabin first
      await request(app.getHttpServer())
        .post('/api/v1/booking-state/cabin')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          flightInstanceId,
          cabinType: 'economy',
          fareClassCode,
        })
        .expect(expect200Or201());

      // Try to save invalid seat
      const response = await request(app.getHttpServer())
        .post('/api/v1/booking-state/seat')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          flightInstanceId,
          flightSeatId: '01900000-0000-7000-8000-000000000000', // Valid UUID v7 format but doesn't exist
          seatNumber: '99Z',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with seat from different flight instance (unhappy case)', async () => {
      // Get seat map from a different flight (if available)
      const searchResult = await trySearchFlightsOneWay(app);
      if (!searchResult || !searchResult.outbound || searchResult.outbound.length <= 1) {
        console.warn('Skipping test: Search microservice not available or insufficient flights');
        return;
      }
      if (searchResult.outbound && searchResult.outbound.length > 1) {
        const differentFlightId = searchResult.outbound[1].flightInstanceId;
        const differentSeatMap = await getSeatMap(app, differentFlightId, 'economy');

        validateSeatMapResponse(differentSeatMap, 'economy');
        const differentSeat = findSelectableSeat(differentSeatMap, 'economy');

        if (differentSeat) {
          // Save cabin for the original flight
          await saveCabinSelection(app, accessToken, flightInstanceId, 'economy', fareClassCode);
          // Try to save seat from different flight - should fail validation
          const response = await request(app.getHttpServer())
            .post('/api/v1/booking-state/seat')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              flightInstanceId, // Original flight instance
              flightSeatId: differentSeat.flightSeatId, // Seat from different flight
              seatNumber: differentSeat.seatNumber,
            })
            .expect(400);

          expect(response.body).toHaveProperty('statusCode', 400);
        }
      }
    });

    it('should fail with unavailable seat (unhappy case)', async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }

      // First, create a reservation to make a seat unavailable
      const reservation1 = await createReservationOneWay(app, accessToken, flightInstanceId, fareClassCode);

      // Get seat map again to find the reserved seat
      const seatMap = await getSeatMap(app, flightInstanceId, 'economy');
      validateSeatMapResponse(seatMap, 'economy');
      
      // Find a reserved/unavailable seat (isAvailable = false)
      let reservedSeat: any = null;
      for (const group of seatMap.seats) {
        if (group.list && group.list.length > 0) {
          reservedSeat = group.list.find((seat: any) => seat.isAvailable === false);
          if (reservedSeat) break;
        }
      }

      if (reservedSeat) {
        // Save cabin first
        await saveCabinSelection(app, accessToken, flightInstanceId, 'economy', fareClassCode);
        // Try to save unavailable seat - should fail
        const response = await request(app.getHttpServer())
          .post('/api/v1/booking-state/seat')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            flightInstanceId,
            flightSeatId: reservedSeat.flightSeatId,
            seatNumber: reservedSeat.seatNumber,
          })
          .expect(400);

        expect(response.body).toHaveProperty('statusCode', 400);
      }
    });

    it('should fail without seat selection (seat is now required)', async () => {
      if (!flightInstanceId || !fareClassCode) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }

      // Save cabin only (no seat)
      await request(app.getHttpServer())
        .post('/api/v1/booking-state/cabin')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          flightInstanceId,
          cabinType: 'economy',
          fareClassCode,
        })
        .expect(expect200Or201());

      // Try to create reservation without seat - should fail
      const response = await request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId,
              segmentType: 'outbound',
            },
          ],
          numberOfPassengers: 1,
          currencyCode: 'VND',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
      expect(response.body.message).toContain('seat');
    });
  });
});

