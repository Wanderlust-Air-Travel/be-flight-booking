import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';

export interface TestUser {
  email: string;
  password: string;
  fullname: string;
  phone: string;
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface TestFlightInstance {
  flightInstanceId: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
}

export interface TestReservation {
  reservationId: string;
  reservationCode: string;
  totalAmount: number;
}

export interface TestBooking {
  bookingId: string;
  pnrCode: string;
  totalAmount: number;
}

export interface TestPayment {
  paymentId: string;
  bookingId: string;
  amount: number;
}

/**
 * Generate a unique email for testing
 */
export function generateTestEmail(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
}

/**
 * Generate a unique phone number for testing
 */
export function generateTestPhone(): string {
  return `090${Math.floor(1000000 + Math.random() * 9000000)}`;
}

/**
 * Generate a date string in the future (for departDate)
 */
export function generateFutureDate(daysFromNow: number = 30): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

/**
 * Register a new test user
 */
export async function registerTestUser(
  app: INestApplication,
  userData?: Partial<TestUser>,
): Promise<TestUser> {
  const user: TestUser = {
    email: userData?.email || generateTestEmail(),
    password: userData?.password || 'TestPassword123!',
    fullname: userData?.fullname || 'Test User',
    phone: userData?.phone || generateTestPhone(),
  };

  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({
      email: user.email,
      password: user.password,
      fullname: user.fullname,
      phone: user.phone,
    })
    .expect(201);

  user.userId = response.body.user?.id || response.body.userId;
  // Register also returns tokens, so we can use them
  if (response.body.access_token) {
    user.accessToken = response.body.access_token;
    user.refreshToken = response.body.refresh_token;
  }
  return user;
}

/**
 * Helper to accept both 200 and 201 status codes (for login/register endpoints)
 */
export function expect200Or201() {
  return (res: any) => {
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`Expected 200 or 201, got ${res.status}`);
    }
  };
}

/**
 * Login and get access token
 */
export async function loginTestUser(
  app: INestApplication,
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(expect200Or201());

  return {
    accessToken: response.body.access_token,
    refreshToken: response.body.refresh_token,
    userId: response.body.user?.id || response.body.userId,
  };
}

/**
 * Create a test user and login
 */
export async function createAndLoginUser(
  app: INestApplication,
  userData?: Partial<TestUser>,
): Promise<TestUser> {
  // Register user - this already returns tokens (201 status)
  const registerResponse = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({
      email: userData?.email || generateTestEmail(),
      password: userData?.password || 'TestPassword123!',
      fullname: userData?.fullname || 'Test User',
      phone: userData?.phone || generateTestPhone(),
    })
    .expect(201);

  const user: TestUser = {
    email: registerResponse.body.user?.email || registerResponse.body.email,
    password: userData?.password || 'TestPassword123!',
    fullname: userData?.fullname || 'Test User',
    phone: userData?.phone || generateTestPhone(),
    userId: registerResponse.body.user?.id || registerResponse.body.userId,
    accessToken: registerResponse.body.access_token || registerResponse.body.user?.access_token,
    refreshToken: registerResponse.body.refresh_token || registerResponse.body.user?.refresh_token,
  };

  // Ensure we have valid tokens
  if (!user.accessToken || !user.refreshToken) {
    throw new Error('Failed to get tokens from register response');
  }

  return user;
}

/**
 * Search flights (one-way) - throws error if not 200
 */
export async function searchFlightsOneWay(
  app: INestApplication,
  origin: string = 'HAN',
  destination: string = 'SGN',
  departDate?: string,
): Promise<any> {
  const response = await request(app.getHttpServer())
    .get('/api/v1/search/flights')
    .query({
      origin,
      destination,
      departDate: departDate || generateFutureDate(30),
      tripType: 'one_way',
      adults: 1,
      minors: 0,
    });

  if (response.status !== 200) {
    const errorMessage = response.body?.message || `Search failed with status ${response.status}`;
    
    // Check for connection errors and provide helpful message
    if (
      errorMessage.includes('Connection closed') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('Search microservice')
    ) {
      throw new Error(
        'Search microservice connection was closed. Please ensure the service is running. ' +
        'Start microservices with: npm run start:search (or docker-compose up)'
      );
    }
    
    const error = new Error(errorMessage);
    (error as any).status = response.status;
    (error as any).body = response.body;
    throw error;
  }

  return response.body;
}

/**
 * Try to search flights (one-way) - returns null if microservice is not available
 */
export async function trySearchFlightsOneWay(
  app: INestApplication,
  origin: string = 'HAN',
  destination: string = 'SGN',
  departDate?: string,
): Promise<any | null> {
  try {
    return await searchFlightsOneWay(app, origin, destination, departDate);
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    if (
      errorMessage.includes('Connection closed') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('Search microservice') ||
      error?.status === 400
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Search flights (round-trip)
 */
export async function searchFlightsRoundTrip(
  app: INestApplication,
  origin: string = 'HAN',
  destination: string = 'SGN',
  departDate?: string,
  returnDate?: string,
): Promise<any> {
  const depDate = departDate || generateFutureDate(30);
  const retDate = returnDate || generateFutureDate(37);

  const response = await request(app.getHttpServer())
    .get('/api/v1/search/flights')
    .query({
      origin,
      destination,
      departDate: depDate,
      returnDate: retDate,
      tripType: 'round_trip',
      adults: 1,
      minors: 0,
    });

  if (response.status !== 200) {
    const errorMessage = response.body?.message || `Search failed with status ${response.status}`;
    
    // Check for connection errors and provide helpful message
    if (
      errorMessage.includes('Connection closed') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('Search microservice')
    ) {
      throw new Error(
        'Search microservice connection was closed. Please ensure the service is running. ' +
        'Start microservices with: npm run start:search (or docker-compose up)'
      );
    }
    
    const error = new Error(errorMessage);
    (error as any).status = response.status;
    (error as any).body = response.body;
    throw error;
  }

  return response.body;
}

/**
 * Get fare options for a flight instance
 */
export async function getFareOptions(
  app: INestApplication,
  flightInstanceId: string,
  cabinType: string = 'economy',
): Promise<any[]> {
  const response = await request(app.getHttpServer())
    .get('/api/v1/search/fare-options')
    .query({
      flightInstanceId,
      cabinType,
    })
    .expect(200);

  return response.body;
}

/**
 * Get seat map for a flight instance
 * @param cabinType - Optional. If not provided, backend will auto-fetch from booking state (if authenticated)
 */
export async function getSeatMap(
  app: INestApplication,
  flightInstanceId: string,
  cabinType?: string,
  accessToken?: string,
): Promise<any> {
  const req = request(app.getHttpServer())
    .get('/api/v1/search/seats')
    .query({
      flightInstanceId,
      ...(cabinType && { cabinType }), // Only add cabinType if provided
    });

  if (accessToken) {
    req.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await req.expect(200);
  return response.body;
}

/**
 * Find first selectable seat from seat map (NEW - Updated for isSelectable field)
 * Returns seat that is both available AND selectable for the requested cabin type
 */
export function findSelectableSeat(seatMap: any, requestedCabinType: string = 'economy'): any | null {
  if (!seatMap || !seatMap.seats || !Array.isArray(seatMap.seats)) {
    return null;
  }

  for (const group of seatMap.seats) {
    if (group.list && Array.isArray(group.list)) {
      const selectableSeat = group.list.find(
        (seat: any) => seat.isAvailable === true && seat.isSelectable === true
      );
      if (selectableSeat) {
        return selectableSeat;
      }
    }
  }

  return null;
}

/**
 * Validate seat map response structure (NEW - Updated for isSelectable field)
 */
export function validateSeatMapResponse(seatMap: any, requestedCabinType?: string): void {
  expect(seatMap).toHaveProperty('flightInstanceId');
  expect(seatMap).toHaveProperty('flightNumber');
  expect(seatMap).toHaveProperty('cabinType');
  expect(seatMap).toHaveProperty('seats');
  expect(Array.isArray(seatMap.seats)).toBe(true);

  // API LUÔN TRẢ VỀ CẢ ECONOMY VÀ BUSINESS SEATS
  expect(seatMap.seats.length).toBeGreaterThanOrEqual(1);
  
  // Check that we have both economy and business groups (if flight has both)
  const groupIds = seatMap.seats.map((g: any) => g.id);
  expect(groupIds).toContain('economy'); // Always has economy
  // Business may or may not exist depending on flight

  // Validate each seat group
  seatMap.seats.forEach((group: any) => {
    expect(group).toHaveProperty('id');
    expect(['business', 'economy']).toContain(group.id);
    expect(group).toHaveProperty('list');
    expect(Array.isArray(group.list)).toBe(true);

    // Validate each seat
    group.list.forEach((seat: any) => {
      expect(seat).toHaveProperty('flightSeatId');
      expect(seat).toHaveProperty('seatNumber');
      expect(seat).toHaveProperty('cabinClassCode');
      expect(seat).toHaveProperty('seatType');
      expect(seat).toHaveProperty('isExitRow');
      expect(seat).toHaveProperty('position');
      expect(seat).toHaveProperty('isAvailable');
      expect(seat).toHaveProperty('note');
      
      // NEW: Check isSelectable field
      expect(seat).toHaveProperty('isSelectable');
      expect(typeof seat.isSelectable).toBe('boolean');

      // Validate isSelectable logic
      if (requestedCabinType) {
        const seatCabinType = seat.cabinClassCode === 'J' ? 'business' : 'economy';
        const isRequestedCabin = seatCabinType === requestedCabinType;
        
        // isSelectable = true only if:
        // 1. Seat belongs to requested cabin type AND
        // 2. Seat is available
        if (isRequestedCabin && seat.isAvailable) {
          expect(seat.isSelectable).toBe(true);
        } else {
          expect(seat.isSelectable).toBe(false);
        }
      }
    });
  });
}

/**
 * Save cabin selection to booking state
 */
export async function saveCabinSelection(
	app: INestApplication,
	accessToken: string,
	flightInstanceId: string | undefined,
	cabinType: 'economy' | 'business' = 'economy',
	fareClassCode: string | undefined = 'YS',
): Promise<{ success: boolean; message: string }> {
	if (!flightInstanceId) {
		throw new Error('flightInstanceId is required but was undefined. Search microservice may not be available.');
	}
	if (!fareClassCode) {
		throw new Error('fareClassCode is required but was undefined. Search microservice may not be available.');
	}

	const response = await request(app.getHttpServer())
		.post('/api/v1/booking-state/cabin')
		.set('Authorization', `Bearer ${accessToken}`)
		.send({
			flightInstanceId,
			cabinType,
			fareClassCode,
		})
		.expect(expect200Or201());

	return response.body;
}

/**
 * Save seat selection to booking state
 */
export async function saveSeatSelection(
	app: INestApplication,
	accessToken: string,
	flightInstanceId: string,
	flightSeatId: string,
	seatNumber: string,
): Promise<{ success: boolean; message: string }> {
	const response = await request(app.getHttpServer())
		.post('/api/v1/booking-state/seat')
		.set('Authorization', `Bearer ${accessToken}`)
		.send({
			flightInstanceId,
			flightSeatId,
			seatNumber,
		})
		.expect(expect200Or201());

	return response.body;
}

/**
 * Get booking state for a specific flight instance
 */
export async function getBookingState(
	app: INestApplication,
	accessToken: string,
	flightInstanceId: string,
): Promise<any> {
	const response = await request(app.getHttpServer())
		.get(`/api/v1/booking-state/${flightInstanceId}`)
		.set('Authorization', `Bearer ${accessToken}`)
		.expect(200);

	return response.body;
}

/**
 * Get all booking states for the authenticated user
 * Returns array of all booking states (stateless frontend - no need to store flightInstanceId in session)
 */
export async function getAllBookingStates(
	app: INestApplication,
	accessToken: string,
): Promise<{ states: any[] }> {
	const response = await request(app.getHttpServer())
		.get('/api/v1/booking-state')
		.set('Authorization', `Bearer ${accessToken}`)
		.expect(200);

	return response.body;
}

/**
 * Create a reservation (one-way)
 * NOTE: With new flow, cabin and seat must be saved to booking state first
 */
export async function createReservationOneWay(
	app: INestApplication,
	accessToken: string,
	flightInstanceId: string,
	fareClassCode: string = 'YS',
	flightSeatId?: string,
): Promise<TestReservation> {
	// New flow: Save cabin and seat to booking state first
	await saveCabinSelection(app, accessToken, flightInstanceId, 'economy', fareClassCode);

	// BEST PRACTICE: Always select a seat (required for reservation creation)
	// If flightSeatId is provided, use it; otherwise, find a selectable seat automatically
	let selectedFlightSeatId = flightSeatId;
	let selectedSeatNumber: string | null = null;

	if (flightSeatId) {
		// Get seat number from seat map for the provided flightSeatId
		const seatMap = await getSeatMap(app, flightInstanceId, 'economy');
		validateSeatMapResponse(seatMap, 'economy');

		// Find seat by flightSeatId in all groups (economy and business)
		for (const group of seatMap.seats) {
			if (group.list && group.list.length > 0) {
				const seat = group.list.find((s: any) => s.flightSeatId === flightSeatId);
				if (seat) {
					selectedSeatNumber = seat.seatNumber;
					break;
				}
			}
		}

		if (!selectedSeatNumber) {
			throw new Error(`Seat with flightSeatId ${flightSeatId} not found in seat map`);
		}
	} else {
		// BEST PRACTICE: Automatically find and select a selectable seat
		const seatMap = await getSeatMap(app, flightInstanceId, 'economy');
		validateSeatMapResponse(seatMap, 'economy');
		
		const selectableSeat = findSelectableSeat(seatMap, 'economy');
		if (!selectableSeat) {
			throw new Error(`No selectable seats available for flight ${flightInstanceId}`);
		}
		
		selectedFlightSeatId = selectableSeat.flightSeatId;
		selectedSeatNumber = selectableSeat.seatNumber;
	}

	// Save seat selection to booking state
	if (selectedFlightSeatId && selectedSeatNumber) {
		await saveSeatSelection(app, accessToken, flightInstanceId, selectedFlightSeatId, selectedSeatNumber);
	}

	// Now create reservation (backend will get cabin + seat from Redis)
	const segment: any = {
		flightInstanceId,
		segmentType: 'outbound',
		// No need to send fareClassCode and flightSeatId - backend gets from Redis
	};

	const response = await request(app.getHttpServer())
		.post('/api/v1/reservations')
		.set('Authorization', `Bearer ${accessToken}`)
		.send({
			segments: [segment],
			numberOfPassengers: 1,
			currencyCode: 'VND',
		})
		.expect(expect200Or201());

	return {
		reservationId: response.body.reservationId,
		reservationCode: response.body.reservationCode,
		totalAmount: response.body.totalAmount,
	};
}

/**
 * Create a reservation (round-trip)
 * NOTE: With new flow, cabin and seat must be saved to booking state first for each flight
 */
export async function createReservationRoundTrip(
	app: INestApplication,
	accessToken: string,
	outboundFlightInstanceId: string,
	inboundFlightInstanceId: string,
	fareClassCode: string = 'YS',
	outboundFlightSeatId?: string,
	inboundFlightSeatId?: string,
): Promise<TestReservation> {
	// New flow: Save cabin and seat for outbound flight
	await saveCabinSelection(app, accessToken, outboundFlightInstanceId, 'economy', fareClassCode);

	// BEST PRACTICE: Always select a seat for outbound flight (required for reservation creation)
	let selectedOutboundFlightSeatId = outboundFlightSeatId;
	let selectedOutboundSeatNumber: string | null = null;

	if (outboundFlightSeatId) {
		const seatMap = await getSeatMap(app, outboundFlightInstanceId, 'economy');
		validateSeatMapResponse(seatMap, 'economy');

		for (const group of seatMap.seats) {
			if (group.list && group.list.length > 0) {
				const seat = group.list.find((s: any) => s.flightSeatId === outboundFlightSeatId);
				if (seat) {
					selectedOutboundSeatNumber = seat.seatNumber;
					break;
				}
			}
		}

		if (!selectedOutboundSeatNumber) {
			throw new Error(`Seat with flightSeatId ${outboundFlightSeatId} not found in seat map for outbound flight`);
		}
	} else {
		// BEST PRACTICE: Automatically find and select a selectable seat
		const seatMap = await getSeatMap(app, outboundFlightInstanceId, 'economy');
		validateSeatMapResponse(seatMap, 'economy');
		
		const selectableSeat = findSelectableSeat(seatMap, 'economy');
		if (!selectableSeat) {
			throw new Error(`No selectable seats available for outbound flight ${outboundFlightInstanceId}`);
		}
		
		selectedOutboundFlightSeatId = selectableSeat.flightSeatId;
		selectedOutboundSeatNumber = selectableSeat.seatNumber;
	}

	if (selectedOutboundFlightSeatId && selectedOutboundSeatNumber) {
		await saveSeatSelection(app, accessToken, outboundFlightInstanceId, selectedOutboundFlightSeatId, selectedOutboundSeatNumber);
	}

	// Save cabin and seat for inbound flight
	await saveCabinSelection(app, accessToken, inboundFlightInstanceId, 'economy', fareClassCode);

	// BEST PRACTICE: Always select a seat for inbound flight (required for reservation creation)
	let selectedInboundFlightSeatId = inboundFlightSeatId;
	let selectedInboundSeatNumber: string | null = null;

	if (inboundFlightSeatId) {
		const seatMap = await getSeatMap(app, inboundFlightInstanceId, 'economy');
		validateSeatMapResponse(seatMap, 'economy');

		for (const group of seatMap.seats) {
			if (group.list && group.list.length > 0) {
				const seat = group.list.find((s: any) => s.flightSeatId === inboundFlightSeatId);
				if (seat) {
					selectedInboundSeatNumber = seat.seatNumber;
					break;
				}
			}
		}

		if (!selectedInboundSeatNumber) {
			throw new Error(`Seat with flightSeatId ${inboundFlightSeatId} not found in seat map for inbound flight`);
		}
	} else {
		// BEST PRACTICE: Automatically find and select a selectable seat
		const seatMap = await getSeatMap(app, inboundFlightInstanceId, 'economy');
		validateSeatMapResponse(seatMap, 'economy');
		
		const selectableSeat = findSelectableSeat(seatMap, 'economy');
		if (!selectableSeat) {
			throw new Error(`No selectable seats available for inbound flight ${inboundFlightInstanceId}`);
		}
		
		selectedInboundFlightSeatId = selectableSeat.flightSeatId;
		selectedInboundSeatNumber = selectableSeat.seatNumber;
	}

	if (selectedInboundFlightSeatId && selectedInboundSeatNumber) {
		await saveSeatSelection(app, accessToken, inboundFlightInstanceId, selectedInboundFlightSeatId, selectedInboundSeatNumber);
	}

	// Now create reservation (backend will get cabin + seat from Redis for each flight)
	const outboundSegment: any = {
		flightInstanceId: outboundFlightInstanceId,
		segmentType: 'outbound',
	};

	const inboundSegment: any = {
		flightInstanceId: inboundFlightInstanceId,
		segmentType: 'inbound',
	};

	const response = await request(app.getHttpServer())
		.post('/api/v1/reservations')
		.set('Authorization', `Bearer ${accessToken}`)
		.send({
			segments: [outboundSegment, inboundSegment],
			numberOfPassengers: 1,
			currencyCode: 'VND',
		})
		.expect(expect200Or201());

	return {
		reservationId: response.body.reservationId,
		reservationCode: response.body.reservationCode,
		totalAmount: response.body.totalAmount,
	};
}

/**
 * Create a booking from reservation
 */
export async function createBookingFromReservation(
  app: INestApplication,
  accessToken: string,
  reservationId: string,
  passengerData?: {
    passengerType?: string;
    fullname?: string;
    dob?: string;
    gender?: string;
    documentNumber?: string;
  },
): Promise<TestBooking> {
  const response = await request(app.getHttpServer())
    .post(`/api/v1/bookings?reservationId=${reservationId}`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      passengers: [
        {
          passengerType: passengerData?.passengerType || 'ADT',
          fullname: passengerData?.fullname || 'Test Passenger',
          dob: passengerData?.dob || '1990-01-15',
          gender: passengerData?.gender || 'Male',
          documentNumber: passengerData?.documentNumber || `001234567890${Date.now()}`,
        },
      ],
      contactFullname: 'Test Contact',
      contactEmail: 'test@example.com',
      contactPhone: '0901234567',
      channel: 'web',
    })
    .expect(201);

  return {
    bookingId: response.body.bookingId,
    pnrCode: response.body.pnrCode,
    totalAmount: response.body.totalAmount,
  };
}

/**
 * Process payment for a booking
 */
export async function processPayment(
  app: INestApplication,
  accessToken: string,
  bookingId: string,
  amount: number,
  paymentMethodCode: string = 'CREDIT_CARD',
): Promise<TestPayment> {
  const response = await request(app.getHttpServer())
    .post(`/api/v1/payments/bookings/${bookingId}/process`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      paymentMethodCode,
      transactionRef: `TXN${Date.now()}`,
      idempotencyKey: `idempotency-${randomUUID()}`,
      amount,
    });

  // Log response for debugging if not 200/201
  if (response.status !== 200 && response.status !== 201) {
    console.error(`[processPayment] Failed with status ${response.status}:`, {
      status: response.status,
      body: response.body,
      bookingId,
      amount,
      paymentMethodCode,
    });
  }

  expect([200, 201]).toContain(response.status);

  return {
    paymentId: response.body.paymentId,
    bookingId: response.body.bookingId,
    amount: response.body.amount,
  };
}

/**
 * Wait for a specified amount of time (useful for async operations)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Verify error response format matches new standard
 * All errors should have: statusCode, timestamp, path, method, requestId, message
 */
export function verifyErrorResponseFormat(response: any, expectedStatusCode: number) {
  expect(response.body).toHaveProperty('statusCode', expectedStatusCode);
  expect(response.body).toHaveProperty('timestamp');
  expect(response.body).toHaveProperty('path');
  expect(response.body).toHaveProperty('method');
  expect(response.body).toHaveProperty('requestId');
  expect(response.body).toHaveProperty('message');

  // Verify timestamp is valid ISO string
  expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);

  // Verify request ID matches header
  expect(response.headers['x-request-id']).toBe(response.body.requestId);
}

/**
 * Verify response has request ID headers
 */
export function verifyRequestIdHeaders(response: any) {
  expect(response.headers['x-request-id']).toBeDefined();
  expect(response.headers['x-correlation-id']).toBeDefined();
  expect(response.headers['x-request-id']).toBe(response.headers['x-correlation-id']);
}

