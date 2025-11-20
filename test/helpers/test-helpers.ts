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
    .post('/auth/register')
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
    .post('/auth/login')
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
    .post('/auth/register')
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
 * Search flights (one-way)
 */
export async function searchFlightsOneWay(
  app: INestApplication,
  origin: string = 'HAN',
  destination: string = 'SGN',
  departDate?: string,
): Promise<any> {
  const response = await request(app.getHttpServer())
    .get('/search/flights')
    .query({
      origin,
      destination,
      departDate: departDate || generateFutureDate(30),
      tripType: 'one_way',
      adults: 1,
      minors: 0,
    })
    .expect(200);

  return response.body;
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
    .get('/search/flights')
    .query({
      origin,
      destination,
      departDate: depDate,
      returnDate: retDate,
      tripType: 'round_trip',
      adults: 1,
      minors: 0,
    })
    .expect(200);

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
    .get('/search/fare-options')
    .query({
      flightInstanceId,
      cabinType,
    })
    .expect(200);

  return response.body;
}

/**
 * Create a reservation (one-way)
 */
export async function createReservationOneWay(
  app: INestApplication,
  accessToken: string,
  flightInstanceId: string,
  fareClassCode: string = 'YS',
): Promise<TestReservation> {
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

  return {
    reservationId: response.body.reservationId,
    reservationCode: response.body.reservationCode,
    totalAmount: response.body.totalAmount,
  };
}

/**
 * Create a reservation (round-trip)
 */
export async function createReservationRoundTrip(
  app: INestApplication,
  accessToken: string,
  outboundFlightInstanceId: string,
  inboundFlightInstanceId: string,
  fareClassCode: string = 'YS',
): Promise<TestReservation> {
  const response = await request(app.getHttpServer())
    .post('/reservations')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      segments: [
        {
          flightInstanceId: outboundFlightInstanceId,
          fareClassCode,
          segmentType: 'outbound',
        },
        {
          flightInstanceId: inboundFlightInstanceId,
          fareClassCode,
          segmentType: 'inbound',
        },
      ],
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
    .post(`/bookings?reservationId=${reservationId}`)
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
    .post(`/payments/bookings/${bookingId}/process`)
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

