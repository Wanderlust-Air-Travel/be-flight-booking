import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/api-gateway/app.module';
import { AllExceptionsFilter } from '../../src/api-gateway/common/filters/all-exceptions.filter';
import { RequestIdInterceptor } from '../../src/api-gateway/common/interceptors/request-id.interceptor';
import { LoggingInterceptor } from '../../src/api-gateway/common/interceptors/logging.interceptor';
import {
  searchFlightsOneWay,
  trySearchFlightsOneWay,
  getFareOptions,
  getSeatMap,
  generateFutureDate,
  verifyErrorResponseFormat,
  verifyRequestIdHeaders,
  createAndLoginUser,
  saveCabinSelection,
  saveSeatSelection,
  validateSeatMapResponse,
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
        });

      // Skip if microservice is unavailable
      if (response.status === 503) {
        console.warn('Skipping test: Search microservice not available');
        return;
      }

      expect(response.status).toBe(200);
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
        });

      // Skip if microservice is unavailable
      if (response.status === 503) {
        console.warn('Skipping test: Search microservice not available');
        return;
      }

      expect(response.status).toBe(404);
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
        });

      // Skip if microservice is unavailable
      if (response.status === 503) {
        console.warn('Skipping test: Search microservice not available');
        return;
      }

      expect(response.status).toBe(200);
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
        });

      // Skip if microservice is unavailable
      if (response.status === 503) {
        console.warn('Skipping test: Search microservice not available');
        return;
      }

      expect(response.status).toBe(200);
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
    let flightInstanceId: string | undefined;

    beforeAll(async () => {
      // Get a flight instance ID from search (gracefully skip if microservice unavailable)
      const searchResult = await trySearchFlightsOneWay(app);
      if (searchResult && searchResult.outbound && searchResult.outbound.length > 0) {
        flightInstanceId = searchResult.outbound[0].flightInstanceId;
      } else {
        console.warn('Skipping fare-options tests: Search microservice not available or no flights found');
        flightInstanceId = undefined;
      }
    });

    it('should get fare options successfully (happy case)', async () => {
      if (!flightInstanceId) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }

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
      if (!flightInstanceId) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }

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
      // This test doesn't need flightInstanceId, so it can run even if search is unavailable
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/fare-options')
        .query({
          cabinType: 'economy',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with missing cabinType (unhappy case)', async () => {
      if (!flightInstanceId) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/api/v1/search/fare-options')
        .query({
          flightInstanceId,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with invalid flightInstanceId (unhappy case)', async () => {
      // This test uses a mock UUID, so it can run even if search is unavailable
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
      if (!flightInstanceId) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/api/v1/search/fare-options')
        .query({
          flightInstanceId,
          cabinType: 'invalid-cabin',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should auto-fetch flightInstanceId and cabinType from booking state when authenticated (NEW - Best Practice)', async () => {
      // Skip if search microservice is not available
      const searchResult = await trySearchFlightsOneWay(app);
      if (!searchResult || !searchResult.outbound || searchResult.outbound.length === 0) {
        console.warn('Skipping test: Search microservice not available');
        return;
      }

      const testFlightInstanceId = searchResult.outbound[0].flightInstanceId;
      if (!testFlightInstanceId) {
        console.warn('Skipping test: No flight instance ID available');
        return;
      }

      // Create authenticated user
      const user = await createAndLoginUser(app);
      const accessToken = user.accessToken!;

      // Get fare options to get fareClassCode
      const fareOptions = await getFareOptions(app, testFlightInstanceId, 'economy');
      if (!fareOptions || fareOptions.length === 0) {
        console.warn('Skipping test: No fare options available');
        return;
      }

      const fareClassCode = fareOptions[0].fareClassCode;

      // Save cabin selection to booking state
      await saveCabinSelection(app, accessToken, testFlightInstanceId, 'economy', fareClassCode);

      // Now call getFareOptions WITHOUT flightInstanceId and cabinType
      // Backend should auto-fetch from booking state
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/fare-options')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({})
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('fareClassCode');
      }
    });

    it('should auto-fetch only cabinType when flightInstanceId is provided (NEW)', async () => {
      // Skip if search microservice is not available
      const searchResult = await trySearchFlightsOneWay(app);
      if (!searchResult || !searchResult.outbound || searchResult.outbound.length === 0) {
        console.warn('Skipping test: Search microservice not available');
        return;
      }

      const testFlightInstanceId = searchResult.outbound[0].flightInstanceId;
      if (!testFlightInstanceId) {
        console.warn('Skipping test: No flight instance ID available');
        return;
      }

      // Create authenticated user
      const user = await createAndLoginUser(app);
      const accessToken = user.accessToken!;

      // Get fare options to get fareClassCode
      const fareOptions = await getFareOptions(app, testFlightInstanceId, 'business');
      if (!fareOptions || fareOptions.length === 0) {
        console.warn('Skipping test: No fare options available');
        return;
      }

      const fareClassCode = fareOptions[0].fareClassCode;

      // Save cabin selection to booking state (business class)
      await saveCabinSelection(app, accessToken, testFlightInstanceId, 'business', fareClassCode);

      // Now call getFareOptions with flightInstanceId but WITHOUT cabinType
      // Backend should auto-fetch cabinType from booking state
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/fare-options')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          flightInstanceId: testFlightInstanceId,
          // cabinType is missing - should be auto-fetched
        })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /search/seats', () => {
    let flightInstanceId: string | undefined;

    beforeAll(async () => {
      // Get a flight instance ID from search (gracefully skip if microservice unavailable)
      const searchResult = await trySearchFlightsOneWay(app);
      if (searchResult && searchResult.outbound && searchResult.outbound.length > 0) {
        flightInstanceId = searchResult.outbound[0].flightInstanceId;
      } else {
        console.warn('Skipping seat map tests: Search microservice not available or no flights found');
        flightInstanceId = undefined;
      }
    });

    it('should get seat map successfully for economy class (happy case)', async () => {
      if (!flightInstanceId) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }

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
      if (!flightInstanceId) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }

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
      // This test doesn't need flightInstanceId, so it can run even if search is unavailable
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/seats')
        .query({
          cabinType: 'economy',
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with missing cabinType (unhappy case)', async () => {
      if (!flightInstanceId) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/api/v1/search/seats')
        .query({
          flightInstanceId,
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
    });

    it('should fail with invalid flightInstanceId (unhappy case)', async () => {
      // This test uses a mock UUID, so it can run even if search is unavailable
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
      if (!flightInstanceId) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }

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
      if (!flightInstanceId) {
        console.warn('Skipping test: Search microservice not available or no flight data');
        return;
      }

      const seatMap = await getSeatMap(app, flightInstanceId, 'economy');
      
      // Validate seat map response structure (includes isSelectable check)
      validateSeatMapResponse(seatMap, 'economy');
      
      // API LUÔN TRẢ VỀ CẢ ECONOMY VÀ BUSINESS SEATS
      expect(seatMap.seats.length).toBeGreaterThanOrEqual(1);
      
      // Find economy and business groups
      const economyGroup = seatMap.seats.find((g: any) => g.id === 'economy');
      const businessGroup = seatMap.seats.find((g: any) => g.id === 'business');
      
      // Economy group should exist
      expect(economyGroup).toBeDefined();
      expect(economyGroup.list.length).toBeGreaterThan(0);
      
      // Check isSelectable for economy seats (requested cabin type)
      if (economyGroup.list.length > 0) {
        const economySeat = economyGroup.list.find((s: any) => s.isAvailable === true);
        if (economySeat) {
          expect(economySeat.isSelectable).toBe(true); // Economy seat with requested cabin type
          expect(economySeat.cabinClassCode).toBe('Y');
        }
      }
      
      // Check isSelectable for business seats (not requested cabin type)
      if (businessGroup && businessGroup.list.length > 0) {
        const businessSeat = businessGroup.list[0];
        expect(businessSeat.isSelectable).toBe(false); // Business seat not requested
        expect(businessSeat.cabinClassCode).toBe('J');
      }
    });

    it('should auto-fetch cabinType from booking state when authenticated (NEW - Best Practice)', async () => {
      // Skip if search microservice is not available
      const searchResult = await trySearchFlightsOneWay(app);
      if (!searchResult || !searchResult.outbound || searchResult.outbound.length === 0) {
        console.warn('Skipping test: Search microservice not available');
        return;
      }

      const testFlightInstanceId = searchResult.outbound[0].flightInstanceId;
      if (!testFlightInstanceId) {
        console.warn('Skipping test: No flight instance ID available');
        return;
      }

      // Create authenticated user
      const user = await createAndLoginUser(app);
      const accessToken = user.accessToken!;

      // Get fare options to get fareClassCode
      const fareOptions = await getFareOptions(app, testFlightInstanceId, 'economy');
      if (!fareOptions || fareOptions.length === 0) {
        console.warn('Skipping test: No fare options available');
        return;
      }

      const fareClassCode = fareOptions[0].fareClassCode;

      // Save cabin selection to booking state
      await saveCabinSelection(app, accessToken, testFlightInstanceId, 'economy', fareClassCode);

      // Now call getSeatMap WITHOUT cabinType
      // Backend should auto-fetch cabinType from booking state
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/seats')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          flightInstanceId: testFlightInstanceId,
          // cabinType is missing - should be auto-fetched
        })
        .expect(200);

      expect(response.body).toHaveProperty('flightInstanceId', testFlightInstanceId);
      expect(response.body).toHaveProperty('cabinType', 'economy');
      expect(response.body).toHaveProperty('seats');
      expect(Array.isArray(response.body.seats)).toBe(true);
      
      // Validate seat map response (includes isSelectable check)
      validateSeatMapResponse(response.body, 'economy');
      
      // API should return both economy and business seats
      expect(response.body.seats.length).toBeGreaterThanOrEqual(1);
    });

    it('should fail when cabinType is missing and no booking state exists (unhappy case)', async () => {
      // Skip if search microservice is not available
      const searchResult = await trySearchFlightsOneWay(app);
      if (!searchResult || !searchResult.outbound || searchResult.outbound.length === 0) {
        console.warn('Skipping test: Search microservice not available');
        return;
      }

      const testFlightInstanceId = searchResult.outbound[0].flightInstanceId;
      if (!testFlightInstanceId) {
        console.warn('Skipping test: No flight instance ID available');
        return;
      }

      // Create authenticated user (but don't save cabin selection)
      const user = await createAndLoginUser(app);
      const accessToken = user.accessToken!;

      // Call getSeatMap WITHOUT cabinType and WITHOUT booking state
      // Should fail with 400 Bad Request
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/seats')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          flightInstanceId: testFlightInstanceId,
          // cabinType is missing and no booking state exists
        })
        .expect(400);

      verifyErrorResponseFormat(response, 400);
      expect(response.body.message).toMatch(/cabinType|booking state/i);
    });
  });
});

