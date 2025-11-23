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
	expect200Or201,
	verifyErrorResponseFormat,
	verifyRequestIdHeaders,
} from '../helpers/test-helpers';

describe('Booking State API (e2e)', () => {
	let app: INestApplication;
	let accessToken: string;
	let flightInstanceId: string | undefined;
	let fareClassCode: string | undefined;
	let flightSeatId: string | undefined;
	let seatNumber: string | undefined;

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
		app.useGlobalInterceptors(new RequestIdInterceptor(), new LoggingInterceptor());

		await app.init();

		// Setup test data
		const user = await createAndLoginUser(app);
		accessToken = user.accessToken!;

		// Get flight instance for testing
		const searchResult = await trySearchFlightsOneWay(app);
		if (searchResult && searchResult.outbound && searchResult.outbound.length > 0) {
			flightInstanceId = searchResult.outbound[0].flightInstanceId;
			if (flightInstanceId) {
				const fareOptions = await getFareOptions(app, flightInstanceId);
				if (fareOptions && fareOptions.length > 0) {
					fareClassCode = fareOptions[0].fareClassCode;
				}

				// Get available seat
				const seatMap = await getSeatMap(app, flightInstanceId, 'economy');
				if (seatMap.seats && seatMap.seats.length > 0) {
					for (const group of seatMap.seats) {
						if (group.list && group.list.length > 0) {
							const availableSeat = group.list.find((seat: any) => seat.isAvailable === true);
							if (availableSeat) {
								flightSeatId = availableSeat.flightSeatId;
								seatNumber = availableSeat.seatNumber;
								break;
							}
						}
					}
				}
			}
		}
	});

	afterAll(async () => {
		await app.close();
	});

	describe('POST /booking-state/cabin', () => {
		it('should save cabin selection successfully (happy case)', async () => {
			if (!flightInstanceId || !fareClassCode) {
				console.warn('Skipping test: Search microservice not available or no flight data');
				return;
			}

			const response = await request(app.getHttpServer())
				.post('/api/v1/booking-state/cabin')
				.set('Authorization', `Bearer ${accessToken}`)
				.send({
					flightInstanceId,
					cabinType: 'economy',
					fareClassCode,
				})
				.expect(expect200Or201());

			expect(response.body).toHaveProperty('success', true);
			expect(response.body).toHaveProperty('message', 'Cabin selection saved successfully');
			verifyRequestIdHeaders(response);
		});

		it('should fail without authentication (unhappy case)', async () => {
			// Use mock UUID v7 if flightInstanceId is not available
			const mockFlightInstanceId = flightInstanceId || '019a8f4a-bb0e-7402-a0c4-27647b89dc71';
			const mockFareClassCode = fareClassCode || 'YS';

			const response = await request(app.getHttpServer())
				.post('/api/v1/booking-state/cabin')
				.send({
					flightInstanceId: mockFlightInstanceId,
					cabinType: 'economy',
					fareClassCode: mockFareClassCode,
				})
				.expect(401);

			verifyErrorResponseFormat(response, 401);
		});

		it('should fail with invalid flightInstanceId (unhappy case)', async () => {
			const response = await request(app.getHttpServer())
				.post('/api/v1/booking-state/cabin')
				.set('Authorization', `Bearer ${accessToken}`)
				.send({
					flightInstanceId: 'invalid-id',
					cabinType: 'economy',
					fareClassCode,
				})
				.expect(400);

			verifyErrorResponseFormat(response, 400);
		});

		it('should fail with invalid cabinType (unhappy case)', async () => {
			// Use mock UUID v7 if flightInstanceId is not available
			const mockFlightInstanceId = flightInstanceId || '019a8f4a-bb0e-7402-a0c4-27647b89dc71';
			const mockFareClassCode = fareClassCode || 'YS';

			const response = await request(app.getHttpServer())
				.post('/api/v1/booking-state/cabin')
				.set('Authorization', `Bearer ${accessToken}`)
				.send({
					flightInstanceId: mockFlightInstanceId,
					cabinType: 'invalid',
					fareClassCode: mockFareClassCode,
				})
				.expect(400);

			verifyErrorResponseFormat(response, 400);
		});

		it('should fail with missing required fields (unhappy case)', async () => {
			// Use mock UUID v7 if flightInstanceId is not available
			const mockFlightInstanceId = flightInstanceId || '019a8f4a-bb0e-7402-a0c4-27647b89dc71';

			const response = await request(app.getHttpServer())
				.post('/api/v1/booking-state/cabin')
				.set('Authorization', `Bearer ${accessToken}`)
				.send({
					flightInstanceId: mockFlightInstanceId,
					// Missing cabinType and fareClassCode
				})
				.expect(400);

			verifyErrorResponseFormat(response, 400);
		});
	});

	describe('POST /booking-state/seat', () => {
		beforeEach(async () => {
			if (!flightInstanceId || !fareClassCode) {
				return; // Skip setup if no flight data
			}

			// Ensure cabin is selected before each seat test
			await request(app.getHttpServer())
				.post('/api/v1/booking-state/cabin')
				.set('Authorization', `Bearer ${accessToken}`)
				.send({
					flightInstanceId,
					cabinType: 'economy',
					fareClassCode,
				});
		});

		it('should save seat selection successfully (happy case)', async () => {
			if (!flightSeatId || !seatNumber) {
				console.warn('No available seat found, skipping seat selection test');
				return;
			}

			const response = await request(app.getHttpServer())
				.post('/api/v1/booking-state/seat')
				.set('Authorization', `Bearer ${accessToken}`)
				.send({
					flightInstanceId,
					flightSeatId,
					seatNumber,
				})
				.expect(expect200Or201());

			expect(response.body).toHaveProperty('success', true);
			expect(response.body).toHaveProperty('message', 'Seat selection saved successfully');
			verifyRequestIdHeaders(response);
		});

		it('should fail without cabin selection (unhappy case)', async () => {
			// Use mock UUID v7 if flightInstanceId is not available
			const mockFlightInstanceId = flightInstanceId || '019a8f4a-bb0e-7402-a0c4-27647b89dc71';
			const mockFlightSeatId = flightSeatId || '019a8f4a-bb0e-7402-a0c4-27647b89dc72';
			const mockSeatNumber = seatNumber || '12A';

			// Clear booking state first
			await request(app.getHttpServer())
				.get(`/api/v1/booking-state/${mockFlightInstanceId}`)
				.set('Authorization', `Bearer ${accessToken}`)
				.catch(() => {
					// Ignore if state doesn't exist
				});

			// Try to save seat without cabin
			const response = await request(app.getHttpServer())
				.post('/api/v1/booking-state/seat')
				.set('Authorization', `Bearer ${accessToken}`)
				.send({
					flightInstanceId: mockFlightInstanceId,
					flightSeatId: mockFlightSeatId,
					seatNumber: mockSeatNumber,
				})
				.expect(400);

			verifyErrorResponseFormat(response, 400);
			expect(response.body.message).toContain('Cabin must be selected');
		});

		it('should fail without authentication (unhappy case)', async () => {
			if (!flightSeatId || !seatNumber) {
				return;
			}

			const response = await request(app.getHttpServer())
				.post('/api/v1/booking-state/seat')
				.send({
					flightInstanceId,
					flightSeatId,
					seatNumber,
				})
				.expect(401);

			verifyErrorResponseFormat(response, 401);
		});

		it('should fail with invalid flightSeatId (unhappy case)', async () => {
			// Use mock UUID v7 if flightInstanceId is not available
			const mockFlightInstanceId = flightInstanceId || '019a8f4a-bb0e-7402-a0c4-27647b89dc71';

			const response = await request(app.getHttpServer())
				.post('/api/v1/booking-state/seat')
				.set('Authorization', `Bearer ${accessToken}`)
				.send({
					flightInstanceId: mockFlightInstanceId,
					flightSeatId: 'invalid-id',
					seatNumber: '12A',
				})
				.expect(400);

			verifyErrorResponseFormat(response, 400);
		});

		it('should fail with missing required fields (unhappy case)', async () => {
			// Use mock UUID v7 if flightInstanceId is not available
			const mockFlightInstanceId = flightInstanceId || '019a8f4a-bb0e-7402-a0c4-27647b89dc71';

			const response = await request(app.getHttpServer())
				.post('/api/v1/booking-state/seat')
				.set('Authorization', `Bearer ${accessToken}`)
				.send({
					flightInstanceId: mockFlightInstanceId,
					// Missing flightSeatId and seatNumber
				})
				.expect(400);

			verifyErrorResponseFormat(response, 400);
		});
	});

	describe('GET /booking-state/:flightInstanceId', () => {
		beforeEach(async () => {
			if (!flightInstanceId || !fareClassCode) {
				return; // Skip setup if no flight data
			}

			// Setup: Save cabin and seat
			await request(app.getHttpServer())
				.post('/api/v1/booking-state/cabin')
				.set('Authorization', `Bearer ${accessToken}`)
				.send({
					flightInstanceId,
					cabinType: 'economy',
					fareClassCode,
				});

			if (flightSeatId && seatNumber) {
				await request(app.getHttpServer())
					.post('/api/v1/booking-state/seat')
					.set('Authorization', `Bearer ${accessToken}`)
					.send({
						flightInstanceId,
						flightSeatId,
						seatNumber,
					});
			}
		});

		it('should get booking state successfully (happy case)', async () => {
			if (!flightInstanceId) {
				console.warn('Skipping test: No flightInstanceId available');
				return;
			}

			const response = await request(app.getHttpServer())
				.get(`/api/v1/booking-state/${flightInstanceId}`)
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(200);

			expect(response.body).toHaveProperty('flightInstanceId', flightInstanceId);
			expect(response.body).toHaveProperty('cabin');
			expect(response.body.cabin).toHaveProperty('flightInstanceId', flightInstanceId);
			expect(response.body.cabin).toHaveProperty('cabinType', 'economy');
			if (fareClassCode) {
				expect(response.body.cabin).toHaveProperty('fareClassCode', fareClassCode);
			}
			if (flightSeatId && seatNumber) {
				expect(response.body).toHaveProperty('seat');
				expect(response.body.seat).toHaveProperty('flightInstanceId', flightInstanceId);
				expect(response.body.seat).toHaveProperty('flightSeatId', flightSeatId);
				expect(response.body.seat).toHaveProperty('seatNumber', seatNumber);
			}
			expect(response.body).toHaveProperty('updatedAt');
			verifyRequestIdHeaders(response);
		});

		it('should fail without authentication (unhappy case)', async () => {
			// Use mock UUID v7 if flightInstanceId is not available
			const mockFlightInstanceId = flightInstanceId || '019a8f4a-bb0e-7402-a0c4-27647b89dc71';

			const response = await request(app.getHttpServer())
				.get(`/api/v1/booking-state/${mockFlightInstanceId}`)
				.expect(401);

			verifyErrorResponseFormat(response, 401);
		});

		it('should fail with invalid flightInstanceId format (unhappy case)', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/v1/booking-state/invalid-id')
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(400);

			verifyErrorResponseFormat(response, 400);
		});

		it('should return 404 for non-existent booking state (unhappy case)', async () => {
			// Use a different flight instance ID that doesn't have state
			const searchResult = await trySearchFlightsOneWay(app);
			if (searchResult && searchResult.outbound && searchResult.outbound.length > 1) {
				const differentFlightId = searchResult.outbound[1].flightInstanceId;
				const response = await request(app.getHttpServer())
					.get(`/api/v1/booking-state/${differentFlightId}`)
					.set('Authorization', `Bearer ${accessToken}`)
					.expect(404);

				verifyErrorResponseFormat(response, 404);
			}
		});
	});

	describe('Booking State Flow Integration', () => {
		it('should complete full flow: cabin -> seat -> get state (happy case)', async () => {
			// Use a different flight instance for this test
			const searchResult = await trySearchFlightsOneWay(app);
			if (!searchResult || !searchResult.outbound || searchResult.outbound.length === 0) {
				console.warn('Skipping test: Search microservice not available');
				return;
			}

			const testFlightId = searchResult.outbound[0].flightInstanceId;
			const fareOptions = await getFareOptions(app, testFlightId);
			if (!fareOptions || fareOptions.length === 0) {
				return;
			}

			const testFareClassCode = fareOptions[0].fareClassCode;

			// Step 1: Save cabin
			const cabinResponse = await request(app.getHttpServer())
				.post('/api/v1/booking-state/cabin')
				.set('Authorization', `Bearer ${accessToken}`)
				.send({
					flightInstanceId: testFlightId,
					cabinType: 'economy',
					fareClassCode: testFareClassCode,
				})
				.expect(expect200Or201());

			expect(cabinResponse.body.success).toBe(true);

			// Step 2: Get state (should have cabin only)
			const stateAfterCabin = await request(app.getHttpServer())
				.get(`/api/v1/booking-state/${testFlightId}`)
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(200);

			expect(stateAfterCabin.body.cabin).toBeDefined();
			expect(stateAfterCabin.body.seat).toBeUndefined();

			// Step 3: Save seat
			const seatMap = await getSeatMap(app, testFlightId, 'economy');
			let testSeatId: string | null = null;
			let testSeatNumber: string | null = null;

			if (seatMap.seats && seatMap.seats.length > 0) {
				for (const group of seatMap.seats) {
					if (group.list && group.list.length > 0) {
						const availableSeat = group.list.find((seat: any) => seat.isAvailable === true);
						if (availableSeat) {
							testSeatId = availableSeat.flightSeatId;
							testSeatNumber = availableSeat.seatNumber;
							break;
						}
					}
				}
			}

			if (testSeatId && testSeatNumber) {
				const seatResponse = await request(app.getHttpServer())
					.post('/api/v1/booking-state/seat')
					.set('Authorization', `Bearer ${accessToken}`)
					.send({
						flightInstanceId: testFlightId,
						flightSeatId: testSeatId,
						seatNumber: testSeatNumber,
					})
					.expect(expect200Or201());

				expect(seatResponse.body.success).toBe(true);

				// Step 4: Get state (should have both cabin and seat)
				const stateAfterSeat = await request(app.getHttpServer())
					.get(`/api/v1/booking-state/${testFlightId}`)
					.set('Authorization', `Bearer ${accessToken}`)
					.expect(200);

				expect(stateAfterSeat.body.cabin).toBeDefined();
				expect(stateAfterSeat.body.seat).toBeDefined();
				expect(stateAfterSeat.body.seat.flightSeatId).toBe(testSeatId);
				expect(stateAfterSeat.body.seat.seatNumber).toBe(testSeatNumber);
			}
		});
	});
});

