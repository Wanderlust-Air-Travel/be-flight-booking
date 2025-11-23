import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/api-gateway/app.module';
import { AllExceptionsFilter } from '../../src/api-gateway/common/filters/all-exceptions.filter';
import { RequestIdInterceptor } from '../../src/api-gateway/common/interceptors/request-id.interceptor';
import { LoggingInterceptor } from '../../src/api-gateway/common/interceptors/logging.interceptor';
import {
  searchFlightsOneWay,
  getFareOptions,
  getSeatMap,
  generateFutureDate,
  verifyErrorResponseFormat,
  verifyRequestIdHeaders,
} from '../helpers/test-helpers';

describe('Search API (e2e)', () => {
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

  describe('GET /search/flights (One-Way)', () => {
    it('should search flights one-way successfully (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/flights')
        .query({
          origin: 'HAN',
          destination: 'SGN',
          departDate: generateFutureDate(30),
          tripType: 'one_way',
          adults: 1,
          minors: 0,
        });
      
      // Skip if microservice is unavailable
      if (response.status === 503) {
        console.warn('Skipping test: Search microservice not available');
        return;
      }
      
      expect(response.status).toBe(200);

      expect(response.body).toHaveProperty('tripType', 'one_way');
      expect(response.body).toHaveProperty('outbound');
      expect(Array.isArray(response.body.outbound)).toBe(true);
    });

    it('should search flights with multiple passengers (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/flights')
        .query({
          origin: 'HAN',
          destination: 'SGN',
          departDate: generateFutureDate(30),
          tripType: 'one_way',
          adults: 2,
          minors: 1,
        })
        .expect(200);

      expect(response.body).toHaveProperty('tripType', 'one_way');
      expect(response.body).toHaveProperty('outbound');
    });

    it('should fail with missing origin (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/flights')
        .query({
          destination: 'SGN',
          departDate: generateFutureDate(30),
          tripType: 'one_way',
          adults: 1,
          minors: 0,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with missing destination (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/flights')
        .query({
          origin: 'HAN',
          departDate: generateFutureDate(30),
          tripType: 'one_way',
          adults: 1,
          minors: 0,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with invalid date format (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/flights')
        .query({
          origin: 'HAN',
          destination: 'SGN',
          departDate: 'invalid-date',
          tripType: 'one_way',
          adults: 1,
          minors: 0,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with past date (unhappy case)', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const pastDateStr = pastDate.toISOString().split('T')[0];

      const response = await request(app.getHttpServer())
        .get('/api/v1/search/flights')
        .query({
          origin: 'HAN',
          destination: 'SGN',
          departDate: pastDateStr,
          tripType: 'one_way',
          adults: 1,
          minors: 0,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with invalid airport code (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/flights')
        .query({
          origin: 'XXX', // Valid format (3 chars) but doesn't exist
          destination: 'SGN',
          departDate: generateFutureDate(30),
          tripType: 'one_way',
          adults: 1,
          minors: 0,
        })
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });

    it('should fail with zero adults (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/flights')
        .query({
          origin: 'HAN',
          destination: 'SGN',
          departDate: generateFutureDate(30),
          tripType: 'one_way',
          adults: 0,
          minors: 0,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should auto-set tripType to one_way when returnDate is missing (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/flights')
        .query({
          origin: 'HAN',
          destination: 'SGN',
          departDate: generateFutureDate(30),
          adults: 1,
          minors: 0,
          // tripType is not provided - should auto-set to one_way
        })
        .expect(200);

      expect(response.body).toHaveProperty('tripType', 'one_way');
      expect(response.body).toHaveProperty('outbound');
      expect(Array.isArray(response.body.outbound)).toBe(true);
      verifyRequestIdHeaders(response);
    });

    it('should fail with invalid tripType (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/flights')
        .query({
          origin: 'HAN',
          destination: 'SGN',
          departDate: generateFutureDate(30),
          tripType: 'invalid_type',
          adults: 1,
          minors: 0,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with negative adults (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/flights')
        .query({
          origin: 'HAN',
          destination: 'SGN',
          departDate: generateFutureDate(30),
          tripType: 'one_way',
          adults: -1,
          minors: 0,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with negative minors (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/flights')
        .query({
          origin: 'HAN',
          destination: 'SGN',
          departDate: generateFutureDate(30),
          tripType: 'one_way',
          adults: 1,
          minors: -1,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });
  });

  describe('GET /search/flights (Round-Trip)', () => {
    it('should search flights round-trip successfully (happy case)', async () => {
      const departDate = generateFutureDate(30);
      const returnDate = generateFutureDate(37);

      const response = await request(app.getHttpServer())
        .get('/api/v1/search/flights')
        .query({
          origin: 'HAN',
          destination: 'SGN',
          departDate,
          returnDate,
          tripType: 'round_trip',
          adults: 1,
          minors: 0,
        })
        .expect(200);

      expect(response.body).toHaveProperty('tripType', 'round_trip');
      expect(response.body).toHaveProperty('outbound');
      expect(response.body).toHaveProperty('inbound');
      expect(Array.isArray(response.body.outbound)).toBe(true);
      expect(Array.isArray(response.body.inbound)).toBe(true);
      verifyRequestIdHeaders(response);
    });

    it('should auto-set tripType to round_trip when returnDate is provided (happy case)', async () => {
      const departDate = generateFutureDate(30);
      const returnDate = generateFutureDate(37);

      const response = await request(app.getHttpServer())
        .get('/api/v1/search/flights')
        .query({
          origin: 'HAN',
          destination: 'SGN',
          departDate,
          returnDate,
          // tripType is not provided - should auto-set to round_trip
          adults: 1,
          minors: 0,
        })
        .expect(200);

      expect(response.body).toHaveProperty('tripType', 'round_trip');
      expect(response.body).toHaveProperty('outbound');
      expect(response.body).toHaveProperty('inbound');
      expect(Array.isArray(response.body.outbound)).toBe(true);
      expect(Array.isArray(response.body.inbound)).toBe(true);
      verifyRequestIdHeaders(response);
    });

    it('should fail with missing returnDate (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/flights')
        .query({
          origin: 'HAN',
          destination: 'SGN',
          departDate: generateFutureDate(30),
          tripType: 'round_trip',
          adults: 1,
          minors: 0,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail when returnDate is before departDate (unhappy case)', async () => {
      const departDate = generateFutureDate(30);
      const returnDate = generateFutureDate(25); // Before departDate

      const response = await request(app.getHttpServer())
        .get('/api/v1/search/flights')
        .query({
          origin: 'HAN',
          destination: 'SGN',
          departDate,
          returnDate,
          tripType: 'round_trip',
          adults: 1,
          minors: 0,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with same origin and destination (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/flights')
        .query({
          origin: 'HAN',
          destination: 'HAN',
          departDate: generateFutureDate(30),
          tripType: 'one_way',
          adults: 1,
          minors: 0,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });
  });

  describe('GET /search/fare-options', () => {
    let flightInstanceId: string;

    beforeAll(async () => {
      // Get a flight instance ID from search
      const searchResult = await searchFlightsOneWay(app);
      if (searchResult.outbound && searchResult.outbound.length > 0) {
        flightInstanceId = searchResult.outbound[0].flightInstanceId;
      } else {
        throw new Error('No flights found for testing');
      }
    });

    it('should get fare options successfully (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/fare-options')
        .query({
          flightInstanceId,
          cabinType: 'economy',
        })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('fareClassCode');
        expect(response.body[0]).toHaveProperty('name');
        expect(response.body[0]).toHaveProperty('price');
        expect(response.body[0]).toHaveProperty('availableSeats');
      }
    });

    it('should get fare options for business class (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/fare-options')
        .query({
          flightInstanceId,
          cabinType: 'business',
        })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should fail with missing flightInstanceId (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/fare-options')
        .query({
          cabinType: 'economy',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with missing cabinType (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/fare-options')
        .query({
          flightInstanceId,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with invalid flightInstanceId (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/fare-options')
        .query({
          flightInstanceId: '01900000-0000-7000-8000-000000000000', // Valid UUID v7 format but doesn't exist
          cabinType: 'economy',
        })
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });

    it('should fail with invalid cabinType (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/fare-options')
        .query({
          flightInstanceId,
          cabinType: 'invalid-cabin',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });
  });

  describe('GET /search/seats', () => {
    let flightInstanceId: string;

    beforeAll(async () => {
      // Get a flight instance ID from search
      const searchResult = await searchFlightsOneWay(app);
      if (searchResult.outbound && searchResult.outbound.length > 0) {
        flightInstanceId = searchResult.outbound[0].flightInstanceId;
      } else {
        throw new Error('No flights found for testing');
      }
    });

    it('should get seat map successfully for economy class (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/seats')
        .query({
          flightInstanceId,
          cabinType: 'economy',
        })
        .expect(200);

      expect(response.body).toHaveProperty('flightInstanceId', flightInstanceId);
      expect(response.body).toHaveProperty('flightNumber');
      expect(response.body).toHaveProperty('cabinType', 'economy');
      expect(response.body).toHaveProperty('seats');
      expect(Array.isArray(response.body.seats)).toBe(true);
      
      if (response.body.seats.length > 0) {
        const seatGroup = response.body.seats[0];
        expect(seatGroup).toHaveProperty('id');
        expect(seatGroup).toHaveProperty('list');
        expect(Array.isArray(seatGroup.list)).toBe(true);
        
        if (seatGroup.list.length > 0) {
          const seat = seatGroup.list[0];
          expect(seat).toHaveProperty('flightSeatId');
          expect(seat).toHaveProperty('seatNumber');
          expect(seat).toHaveProperty('cabinClassCode');
          expect(seat).toHaveProperty('position');
          expect(seat).toHaveProperty('isAvailable');
          expect(['left', 'right']).toContain(seat.position);
        }
      }
    });

    it('should get seat map successfully for business class (happy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/seats')
        .query({
          flightInstanceId,
          cabinType: 'business',
        })
        .expect(200);

      expect(response.body).toHaveProperty('flightInstanceId', flightInstanceId);
      expect(response.body).toHaveProperty('cabinType', 'business');
      expect(response.body).toHaveProperty('seats');
      expect(Array.isArray(response.body.seats)).toBe(true);
    });

    it('should fail with missing flightInstanceId (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/seats')
        .query({
          cabinType: 'economy',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with missing cabinType (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/seats')
        .query({
          flightInstanceId,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with invalid flightInstanceId (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/seats')
        .query({
          flightInstanceId: '01900000-0000-7000-8000-000000000000', // Valid UUID v7 format but doesn't exist
          cabinType: 'economy',
        })
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });

    it('should fail with invalid cabinType (unhappy case)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/seats')
        .query({
          flightInstanceId,
          cabinType: 'invalid-cabin',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should return seats with correct structure (happy case)', async () => {
      const seatMap = await getSeatMap(app, flightInstanceId, 'economy');
      
      expect(seatMap).toHaveProperty('seats');
      expect(Array.isArray(seatMap.seats)).toBe(true);
      
      // Check if there are any seats
      if (seatMap.seats.length > 0) {
        const seatGroup = seatMap.seats[0];
        expect(seatGroup).toHaveProperty('id');
        expect(['business', 'economy']).toContain(seatGroup.id);
        expect(seatGroup).toHaveProperty('list');
        
        // Check seat properties
        if (seatGroup.list.length > 0) {
          const seat = seatGroup.list[0];
          expect(seat).toHaveProperty('flightSeatId');
          expect(seat).toHaveProperty('seatNumber');
          expect(seat).toHaveProperty('cabinClassCode');
          expect(seat).toHaveProperty('seatType');
          expect(seat).toHaveProperty('isExitRow');
          expect(seat).toHaveProperty('position');
          expect(seat).toHaveProperty('isAvailable');
          expect(seat).toHaveProperty('note');
        }
      }
    });
  });
});

