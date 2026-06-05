/**
 * Messages Index
 *
 * Tập trung tất cả messages từ các domain
 * Import từ: import { AUTH_MESSAGES, BOOKING_MESSAGES, ... } from 'src/shared/constants/messages';
 */

export * from './auth.messages';
export * from './booking.messages';
export * from './payment.messages';
export * from './search.messages';
export * from './reservation.messages';
export * from './common.messages';

/**
 * Helper type để lấy message từ bất kỳ domain nào
 */
export type MessageKey =
    | keyof typeof import('./auth.messages').AUTH_MESSAGES.SUCCESS
    | keyof typeof import('./auth.messages').AUTH_MESSAGES.ERROR
    | keyof typeof import('./auth.messages').AUTH_MESSAGES.VALIDATION
    | keyof typeof import('./booking.messages').BOOKING_MESSAGES.SUCCESS
    | keyof typeof import('./booking.messages').BOOKING_MESSAGES.ERROR
    | keyof typeof import('./booking.messages').BOOKING_MESSAGES.VALIDATION
    | keyof typeof import('./payment.messages').PAYMENT_MESSAGES.SUCCESS
    | keyof typeof import('./payment.messages').PAYMENT_MESSAGES.ERROR
    | keyof typeof import('./payment.messages').PAYMENT_MESSAGES.VALIDATION
    | keyof typeof import('./search.messages').SEARCH_MESSAGES.SUCCESS
    | keyof typeof import('./search.messages').SEARCH_MESSAGES.ERROR
    | keyof typeof import('./search.messages').SEARCH_MESSAGES.VALIDATION
    | keyof typeof import('./reservation.messages').RESERVATION_MESSAGES.SUCCESS
    | keyof typeof import('./reservation.messages').RESERVATION_MESSAGES.ERROR
    | keyof typeof import('./reservation.messages').RESERVATION_MESSAGES.VALIDATION
    | keyof typeof import('./common.messages').COMMON_MESSAGES.SUCCESS
    | keyof typeof import('./common.messages').COMMON_MESSAGES.ERROR
    | keyof typeof import('./common.messages').COMMON_MESSAGES.VALIDATION;
