// Global test setup
// This file runs before all tests

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file from project root
config({ path: resolve(process.cwd(), '.env') });

// Ensure microservice connection settings for E2E tests
// When running tests, API Gateway runs on localhost and connects to microservices
// If microservices are running in Docker, they should be exposed on localhost ports
if (!process.env.PAYMENT_MS_HOST) {
  process.env.PAYMENT_MS_HOST = '127.0.0.1';
}
if (!process.env.PAYMENT_MS_PORT) {
  process.env.PAYMENT_MS_PORT = '4006';
}
if (!process.env.SEARCH_MS_HOST) {
  process.env.SEARCH_MS_HOST = '127.0.0.1';
}
if (!process.env.SEARCH_MS_PORT) {
  process.env.SEARCH_MS_PORT = '4001';
}
if (!process.env.BOOKING_MS_HOST) {
  process.env.BOOKING_MS_HOST = '127.0.0.1';
}
if (!process.env.BOOKING_MS_PORT) {
  process.env.BOOKING_MS_PORT = '4004';
}
if (!process.env.RESERVATION_MS_HOST) {
  process.env.RESERVATION_MS_HOST = '127.0.0.1';
}
if (!process.env.RESERVATION_MS_PORT) {
  process.env.RESERVATION_MS_PORT = '4005';
}
if (!process.env.EMAIL_MS_HOST) {
  process.env.EMAIL_MS_HOST = '127.0.0.1';
}
if (!process.env.EMAIL_MS_PORT) {
  process.env.EMAIL_MS_PORT = '4007';
}

// Increase timeout for e2e tests (they may take longer)
jest.setTimeout(60000); // 60 seconds

// Suppress console errors in tests (optional, uncomment if needed)
// global.console = {
//   ...console,
//   error: jest.fn(),
//   warn: jest.fn(),
// };

