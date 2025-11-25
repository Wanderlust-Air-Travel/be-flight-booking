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
	getAllBookingStates,
	expect200Or201,
	verifyErrorResponseFormat,
	verifyRequestIdHeaders,
	validateSeatMapResponse,
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

				// Get available seat (with isSelectable check)
				const seatMap = await getSeatMap(app, flightInstanceId, 'economy');
				if (seatMap.seats && seatMap.seats.length > 0) {
					for (const group of seatMap.seats) {
						if (group.list && group.list.length > 0) {
							// Find seat that is both available AND selectable (for economy cabin)
							const selectableSeat = group.list.find(
								(seat: any) => seat.isAvailable === true && seat.isSelectable === true
							);
							if (selectableSeat) {
								flightSeatId = selectableSeat.flightSeatId;
								seatNumber = selectableSeat.seatNumber;
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

			// Clear booking state first (DELETE to ensure no state exists)
			try {
				await request(app.getHttpServer())
					.delete(`/api/v1/booking-state/${mockFlightInstanceId}`)
					.set('Authorization', `Bearer ${accessToken}`)
					.expect(204);
			} catch {
				// Ignore if state doesn't exist (idempotent)
			}

			// Try to save seat without cabin - should fail with cabin validation
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

	describe('GET /booking-state (Get All Booking States)', () => {
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

		it('should get all booking states successfully (happy case)', async () => {
			if (!flightInstanceId) {
				console.warn('Skipping test: No flightInstanceId available');
				return;
			}

			const response = await request(app.getHttpServer())
				.get('/api/v1/booking-state')
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(200);

			expect(response.body).toHaveProperty('states');
			expect(Array.isArray(response.body.states)).toBe(true);
			
			// Should have at least one state
			if (response.body.states.length > 0) {
				const state = response.body.states[0];
				expect(state).toHaveProperty('flightInstanceId');
				expect(state).toHaveProperty('updatedAt');
				
				// Check if state has cabin
				if (state.cabin) {
					expect(state.cabin).toHaveProperty('flightInstanceId');
					expect(state.cabin).toHaveProperty('cabinType');
					expect(state.cabin).toHaveProperty('fareClassCode');
				}
				
				// Check if state has seat
				if (state.seat) {
					expect(state.seat).toHaveProperty('flightInstanceId');
					expect(state.seat).toHaveProperty('flightSeatId');
					expect(state.seat).toHaveProperty('seatNumber');
				}
			}
			
			verifyRequestIdHeaders(response);
		});

		it('should return empty array if no booking states exist (happy case)', async () => {
			// Create a new user with no booking states
			const newUser = await createAndLoginUser(app);
			const newAccessToken = newUser.accessToken!;

			const response = await request(app.getHttpServer())
				.get('/api/v1/booking-state')
				.set('Authorization', `Bearer ${newAccessToken}`)
				.expect(200);

			expect(response.body).toHaveProperty('states');
			expect(Array.isArray(response.body.states)).toBe(true);
			expect(response.body.states.length).toBe(0);
			verifyRequestIdHeaders(response);
		});

		it('should fail without authentication (unhappy case)', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/v1/booking-state')
				.expect(401);

			verifyErrorResponseFormat(response, 401);
		});

		it('should return multiple states if user has multiple booking states (happy case)', async () => {
			if (!flightInstanceId || !fareClassCode) {
				console.warn('Skipping test: No flight data available');
				return;
			}

			// Create a second booking state with a different flight
			const searchResult = await trySearchFlightsOneWay(app);
			if (searchResult && searchResult.outbound && searchResult.outbound.length > 1) {
				const secondFlightId = searchResult.outbound[1].flightInstanceId;
				const fareOptions = await getFareOptions(app, secondFlightId);
				
				if (fareOptions && fareOptions.length > 0) {
					// Save cabin for second flight
					await request(app.getHttpServer())
						.post('/api/v1/booking-state/cabin')
						.set('Authorization', `Bearer ${accessToken}`)
						.send({
							flightInstanceId: secondFlightId,
							cabinType: 'economy',
							fareClassCode: fareOptions[0].fareClassCode,
						});

					// Get all states
					const response = await request(app.getHttpServer())
						.get('/api/v1/booking-state')
						.set('Authorization', `Bearer ${accessToken}`)
						.expect(200);

					expect(response.body.states.length).toBeGreaterThanOrEqual(1);
					
					// Verify all states have flightInstanceId
					response.body.states.forEach((state: any) => {
						expect(state).toHaveProperty('flightInstanceId');
						expect(state).toHaveProperty('updatedAt');
					});
					
					verifyRequestIdHeaders(response);
				}
			}
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
				
				// Ensure booking state doesn't exist by clearing it first
				try {
					await request(app.getHttpServer())
						.delete(`/api/v1/booking-state/${differentFlightId}`)
						.set('Authorization', `Bearer ${accessToken}`)
						.expect(204);
				} catch {
					// Ignore if state doesn't exist (idempotent)
				}
				
				const response = await request(app.getHttpServer())
					.get(`/api/v1/booking-state/${differentFlightId}`)
					.set('Authorization', `Bearer ${accessToken}`)
					.expect(404);

				verifyErrorResponseFormat(response, 404);
			}
		});
	});

	describe('Booking State Flow Integration', () => {
		it('should demonstrate stateless frontend: get flightInstanceId from getAllBookingStates (happy case)', async () => {
			// This test demonstrates that frontend doesn't need to store flightInstanceId in session
			// Frontend can get it from GET /api/v1/booking-state
			
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

			// Step 1: Save cabin (frontend uses component state for flightInstanceId)
			await request(app.getHttpServer())
				.post('/api/v1/booking-state/cabin')
				.set('Authorization', `Bearer ${accessToken}`)
				.send({
					flightInstanceId: testFlightId,
					cabinType: 'economy',
					fareClassCode: testFareClassCode,
				})
				.expect(expect200Or201());

			// Step 2: Frontend can get flightInstanceId from backend (stateless approach)
			// Instead of storing in session, frontend calls GET /api/v1/booking-state
			const allStatesResponse = await request(app.getHttpServer())
				.get('/api/v1/booking-state')
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(200);

			expect(allStatesResponse.body.states.length).toBeGreaterThan(0);
			
			// Find the state we just created
			const savedState = allStatesResponse.body.states.find(
				(state: any) => state.flightInstanceId === testFlightId
			);
			
			expect(savedState).toBeDefined();
			expect(savedState.flightInstanceId).toBe(testFlightId);
			expect(savedState.cabin).toBeDefined();
			expect(savedState.cabin.cabinType).toBe('economy');
			
			// Step 3: Frontend can use flightInstanceId from backend state
			// No need to store in session - backend is source of truth
			const retrievedFlightId = savedState.flightInstanceId;
			
			// Step 4: Use retrieved flightInstanceId to get specific state
			const specificStateResponse = await request(app.getHttpServer())
				.get(`/api/v1/booking-state/${retrievedFlightId}`)
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(200);

			expect(specificStateResponse.body.flightInstanceId).toBe(testFlightId);
			expect(specificStateResponse.body.cabin).toBeDefined();
		});

		it('should complete full flow: cabin -> seat -> get state (happy case)', async () => {
			// Use a different flight instance for this test
			const searchResult = await trySearchFlightsOneWay(app);
			if (!searchResult || !searchResult.outbound || searchResult.outbound.length === 0) {
				console.warn('Skipping test: Search microservice not available');
				return;
			}

			const testFlightId = searchResult.outbound[0].flightInstanceId;
			
			// Clear booking state first to ensure clean test
			try {
				await request(app.getHttpServer())
					.delete(`/api/v1/booking-state/${testFlightId}`)
					.set('Authorization', `Bearer ${accessToken}`)
					.expect(204);
			} catch {
				// Ignore if state doesn't exist (idempotent)
			}
			
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

			// Step 2: Get state (should have cabin only, no seat)
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

			// Validate seat map response structure
			validateSeatMapResponse(seatMap, 'economy');
			
			if (seatMap.seats && seatMap.seats.length > 0) {
				for (const group of seatMap.seats) {
					if (group.list && group.list.length > 0) {
						// Find seat that is both available AND selectable (for economy cabin)
						const selectableSeat = group.list.find(
							(seat: any) => seat.isAvailable === true && seat.isSelectable === true
						);
						if (selectableSeat) {
							testSeatId = selectableSeat.flightSeatId;
							testSeatNumber = selectableSeat.seatNumber;
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

	describe('DELETE /booking-state/:flightInstanceId', () => {
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

		it('should clear booking state successfully (happy case)', async () => {
			if (!flightInstanceId) {
				console.warn('Skipping test: No flightInstanceId available');
				return;
			}

			// Verify state exists before deletion
			await request(app.getHttpServer())
				.get(`/api/v1/booking-state/${flightInstanceId}`)
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(200);

			// Delete state
			const response = await request(app.getHttpServer())
				.delete(`/api/v1/booking-state/${flightInstanceId}`)
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(204);

			// Verify state is deleted
			await request(app.getHttpServer())
				.get(`/api/v1/booking-state/${flightInstanceId}`)
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(404);
		});

		it('should be idempotent - can delete multiple times (happy case)', async () => {
			// Use mock UUID v7 if flightInstanceId is not available
			const mockFlightInstanceId = flightInstanceId || '019a8f4a-bb0e-7402-a0c4-27647b89dc71';

			// First delete
			await request(app.getHttpServer())
				.delete(`/api/v1/booking-state/${mockFlightInstanceId}`)
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(204);

			// Second delete (should not error - idempotent)
			await request(app.getHttpServer())
				.delete(`/api/v1/booking-state/${mockFlightInstanceId}`)
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(204);

			// Third delete (should not error - idempotent)
			await request(app.getHttpServer())
				.delete(`/api/v1/booking-state/${mockFlightInstanceId}`)
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(204);
		});

		it('should fail without authentication (unhappy case)', async () => {
			// Use mock UUID v7 if flightInstanceId is not available
			const mockFlightInstanceId = flightInstanceId || '019a8f4a-bb0e-7402-a0c4-27647b89dc71';

			const response = await request(app.getHttpServer())
				.delete(`/api/v1/booking-state/${mockFlightInstanceId}`)
				.expect(401);

			verifyErrorResponseFormat(response, 401);
		});

		it('should fail with invalid flightInstanceId format (unhappy case)', async () => {
			const response = await request(app.getHttpServer())
				.delete('/api/v1/booking-state/invalid-id')
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(400);

			verifyErrorResponseFormat(response, 400);
		});
	});
});

