import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/api-gateway/app.module';
import {
  createAndLoginUser,
  searchFlightsOneWay,
  searchFlightsRoundTrip,
  getFareOptions,
  getSeatMap,
  createReservationOneWay,
  createReservationRoundTrip,
  generateFutureDate,
  expect200Or201,
} from '../helpers/test-helpers';

describe('Reservation API (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let flightInstanceId: string;
  let returnFlightInstanceId: string;
  let fareClassCode: string;

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

    // Setup test data
    const user = await createAndLoginUser(app);
    accessToken = user.accessToken!;

    // Get flight instance for testing
    const searchResult = await searchFlightsOneWay(app);
    if (searchResult.outbound && searchResult.outbound.length > 0) {
      flightInstanceId = searchResult.outbound[0].flightInstanceId;
      const fareOptions = await getFareOptions(app, flightInstanceId);
      if (fareOptions && fareOptions.length > 0) {
        fareClassCode = fareOptions[0].fareClassCode;
      }
    }

    // Get return flight for round-trip
    const roundTripResult = await searchFlightsRoundTrip(app);
    if (roundTripResult.inbound && roundTripResult.inbound.length > 0) {
      returnFlightInstanceId = roundTripResult.inbound[0].flightInstanceId;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /reservations (One-Way)', () => {
    it('should create reservation one-way successfully (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId,
              fareClassCode,
              segmentType: 'outbound',
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
    });

    it('should fail without authentication (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/reservations')
        .send({
          segments: [
            {
              flightInstanceId,
              fareClassCode,
              segmentType: 'outbound',
            },
          ],
          numberOfPassengers: 1,
          currencyCode: 'VND',
        })
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
    });

    it('should fail with missing segments (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          numberOfPassengers: 1,
          currencyCode: 'VND',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should fail with invalid flightInstanceId (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId: 'invalid-id',
              fareClassCode,
              segmentType: 'outbound',
            },
          ],
          numberOfPassengers: 1,
          currencyCode: 'VND',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should fail with zero passengers (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId,
              fareClassCode,
              segmentType: 'outbound',
            },
          ],
          numberOfPassengers: 0,
          currencyCode: 'VND',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should fail with invalid fareClassCode (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId,
              fareClassCode: 'INVALID',
              segmentType: 'outbound',
            },
          ],
          numberOfPassengers: 1,
          currencyCode: 'VND',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should create reservation without currencyCode (currencyCode is optional)', async () => {
      const response = await request(app.getHttpServer())
        .post('/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId,
              fareClassCode,
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
        .post('/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [],
          numberOfPassengers: 1,
          currencyCode: 'VND',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should fail with invalid segmentType (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId,
              fareClassCode,
              segmentType: 'invalid_type',
            },
          ],
          numberOfPassengers: 1,
          currencyCode: 'VND',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('POST /reservations (Round-Trip)', () => {
    it('should create reservation round-trip successfully (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId,
              fareClassCode,
              segmentType: 'outbound',
            },
            {
              flightInstanceId: returnFlightInstanceId,
              fareClassCode,
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
      const response = await request(app.getHttpServer())
        .post('/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId,
              fareClassCode,
              segmentType: 'outbound',
            },
            {
              flightInstanceId: 'invalid-return-id',
              fareClassCode,
              segmentType: 'inbound',
            },
          ],
          numberOfPassengers: 1,
          currencyCode: 'VND',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('GET /reservations', () => {
    it('should list reservations successfully (happy case)', async () => {
      // Create a reservation first
      await createReservationOneWay(app, accessToken, flightInstanceId, fareClassCode);

      const response = await request(app.getHttpServer())
        .get('/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should fail without authentication (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/reservations')
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
    });
  });

  describe('GET /reservations/:id', () => {
    let reservationId: string;

    beforeAll(async () => {
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );
      reservationId = reservation.reservationId;
    });

    it('should get reservation by ID successfully (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('reservationId', reservationId);
      expect(response.body).toHaveProperty('reservationCode');
      expect(response.body).toHaveProperty('totalAmount');
    });

    it('should fail with invalid reservation ID (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/reservations/invalid-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('GET /reservations/code/:code', () => {
    let reservationCode: string;

    beforeAll(async () => {
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );
      reservationCode = reservation.reservationCode;
    });

    it('should get reservation by code successfully (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/reservations/code/${reservationCode}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('reservationCode', reservationCode);
      expect(response.body).toHaveProperty('reservationId');
    });

    it('should fail with invalid reservation code (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/reservations/code/INVALID')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('POST /reservations/:id/cancel', () => {
    let reservationId: string;

    beforeEach(async () => {
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );
      reservationId = reservation.reservationId;
    });

    it('should cancel reservation successfully (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/reservations/${reservationId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should fail with invalid reservation ID (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/reservations/invalid-id/cancel')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should fail when canceling already cancelled reservation (unhappy case)', async () => {
      // Cancel first time
      await request(app.getHttpServer())
        .post(`/reservations/${reservationId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Try to cancel again
      const response = await request(app.getHttpServer())
        .post(`/reservations/${reservationId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('POST /reservations/:id/extend', () => {
    let reservationId: string;

    beforeEach(async () => {
      const reservation = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );
      reservationId = reservation.reservationId;
    });

    it('should extend reservation successfully (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/reservations/${reservationId}/extend`)
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
      const response = await request(app.getHttpServer())
        .post(`/reservations/${reservationId}/extend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          additionalSeconds: -100,
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should fail with missing additionalSeconds (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/reservations/${reservationId}/extend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('POST /reservations (With Seat Selection)', () => {
    it('should create reservation with seat selection successfully (happy case)', async () => {
      // Get seat map first
      const seatMap = await getSeatMap(app, flightInstanceId, 'economy');
      
      // Find an available seat
      let availableSeat: any = null;
      if (seatMap.seats && seatMap.seats.length > 0) {
        for (const group of seatMap.seats) {
          if (group.list && group.list.length > 0) {
            availableSeat = group.list.find((seat: any) => seat.isAvailable === true);
            if (availableSeat) break;
          }
        }
      }

      if (!availableSeat) {
        // Skip test if no available seats
        console.warn('No available seats found for seat selection test');
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId,
              fareClassCode,
              segmentType: 'outbound',
              flightSeatId: availableSeat.flightSeatId,
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

    it('should fail with invalid flightSeatId (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .post('/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId,
              fareClassCode,
              segmentType: 'outbound',
              flightSeatId: '01900000-0000-7000-8000-000000000000', // Valid UUID v7 format but doesn't exist
            },
          ],
          numberOfPassengers: 1,
          currencyCode: 'VND',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should fail with seat from different flight instance (unhappy case)', async () => {
      // Get seat map from a different flight (if available)
      const searchResult = await searchFlightsOneWay(app);
      if (searchResult.outbound && searchResult.outbound.length > 1) {
        const differentFlightId = searchResult.outbound[1].flightInstanceId;
        const differentSeatMap = await getSeatMap(app, differentFlightId, 'economy');
        
        let differentSeat: any = null;
        if (differentSeatMap.seats && differentSeatMap.seats.length > 0) {
          for (const group of differentSeatMap.seats) {
            if (group.list && group.list.length > 0) {
              differentSeat = group.list.find((seat: any) => seat.isAvailable === true);
              if (differentSeat) break;
            }
          }
        }

        if (differentSeat) {
          const response = await request(app.getHttpServer())
            .post('/reservations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              segments: [
                {
                  flightInstanceId, // Different flight instance
                  fareClassCode,
                  segmentType: 'outbound',
                  flightSeatId: differentSeat.flightSeatId, // Seat from different flight
                },
              ],
              numberOfPassengers: 1,
              currencyCode: 'VND',
            })
            .expect(400);

          expect(response.body).toHaveProperty('statusCode', 400);
        }
      }
    });

    it('should fail with unavailable seat (unhappy case)', async () => {
      // First, create a reservation to make a seat unavailable
      const reservation1 = await createReservationOneWay(
        app,
        accessToken,
        flightInstanceId,
        fareClassCode,
      );

      // Get seat map again to find the reserved seat
      const seatMap = await getSeatMap(app, flightInstanceId, 'economy');
      let reservedSeat: any = null;
      if (seatMap.seats && seatMap.seats.length > 0) {
        for (const group of seatMap.seats) {
          if (group.list && group.list.length > 0) {
            reservedSeat = group.list.find((seat: any) => seat.isAvailable === false);
            if (reservedSeat) break;
          }
        }
      }

      if (reservedSeat) {
        const response = await request(app.getHttpServer())
          .post('/reservations')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            segments: [
              {
                flightInstanceId,
                fareClassCode,
                segmentType: 'outbound',
                flightSeatId: reservedSeat.flightSeatId,
              },
            ],
            numberOfPassengers: 1,
            currencyCode: 'VND',
          })
          .expect(400);

        expect(response.body).toHaveProperty('statusCode', 400);
      }
    });

    it('should create reservation without seat selection (seat is optional)', async () => {
      const response = await request(app.getHttpServer())
        .post('/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          segments: [
            {
              flightInstanceId,
              fareClassCode,
              segmentType: 'outbound',
              // No flightSeatId - seat selection is optional
            },
          ],
          numberOfPassengers: 1,
          currencyCode: 'VND',
        })
        .expect(expect200Or201());

      expect(response.body).toHaveProperty('reservationId');
      expect(response.body).toHaveProperty('segments');
      expect(response.body.segments.length).toBe(1);
      // Seat fields should be null or undefined when not selected
      expect(response.body.segments[0].flightSeatId).toBeFalsy();
    });
  });
});

