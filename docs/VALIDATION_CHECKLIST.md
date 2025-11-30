# Validation Checklist

## Tổng quan

File này liệt kê tất cả các DTOs và Schemas đã được validate để đảm bảo tính nhất quán giữa FE và BE.

## Backend DTOs - Đã Validate

### Auth Module
- `RegisterDto` - Sử dụng `IsStrongPassword`, `IsVietnamesePhone`, messages từ `AUTH_MESSAGES`
- `LoginDto` - Sử dụng messages từ `AUTH_MESSAGES`
- `RefreshDto` - Sử dụng `IsUUIDv7`, messages từ `AUTH_MESSAGES`, `COMMON_MESSAGES`
- `LogoutDto` - Sử dụng `IsUUIDv7`, messages từ `AUTH_MESSAGES`, `COMMON_MESSAGES`
- `SendOtpPaymentDto` - Sử dụng `IsUUIDv7`, messages từ `AUTH_MESSAGES`, `COMMON_MESSAGES`
- `VerifyOtpPaymentDto` - Sử dụng `IsUUIDv7`, OTP validation, messages từ `AUTH_MESSAGES`
- `SendOtpPasswordResetDto` - Sử dụng messages từ `AUTH_MESSAGES`
- `VerifyOtpPasswordResetDto` - Sử dụng `IsStrongPassword`, OTP validation, messages từ `AUTH_MESSAGES`
- `SendOtpCancellationDto` - Sử dụng `IsUUIDv7`, messages từ `AUTH_MESSAGES`, `BOOKING_MESSAGES`, `COMMON_MESSAGES`
- `VerifyOtpCancellationDto` - Sử dụng `IsUUIDv7`, OTP validation, messages từ `AUTH_MESSAGES`, `BOOKING_MESSAGES`, `COMMON_MESSAGES`

### Booking Module
- `CreateBookingDto` - Sử dụng `IsUUIDv7`, messages từ `BOOKING_MESSAGES`, `COMMON_MESSAGES`
- `CreateBookingFromReservationDto` - Sử dụng `IsVietnamesePhone`, messages từ `BOOKING_MESSAGES`, `AUTH_MESSAGES`
- `CreateBookingPassengerDto` - Sử dụng messages từ `BOOKING_MESSAGES`
- `CreateBookingSegmentDto` - Sử dụng `IsUUIDv7`, messages từ `BOOKING_MESSAGES`, `COMMON_MESSAGES`
- `UpdateBookingPassengersDto` - Sử dụng messages từ `BOOKING_MESSAGES`
- `CancelBookingDto` - Sử dụng OTP validation, messages từ `AUTH_MESSAGES`
- `CancelTicketDto` - Sử dụng OTP validation, messages từ `AUTH_MESSAGES`

### Payment Module
- `CreatePaymentDto` - Sử dụng messages từ `PAYMENT_MESSAGES`
- `UpdatePaymentStatusDto` - Sử dụng messages từ `PAYMENT_MESSAGES`

### Reservation Module
- `CreateReservationDto` - Sử dụng `IsUUIDv7`, messages từ `RESERVATION_MESSAGES`, `COMMON_MESSAGES`
- `CreateReservationSegmentDto` - Sử dụng `IsUUIDv7`, messages từ `RESERVATION_MESSAGES`, `COMMON_MESSAGES`

### Search Module
- `SearchFlightsDto` - Sử dụng messages từ `SEARCH_MESSAGES`
- `GetFareOptionsDto` - Sử dụng `IsUUIDv7`, messages từ `COMMON_MESSAGES`
- `GetSeatMapDto` - Sử dụng `IsUUIDv7`, messages từ `SEARCH_MESSAGES`, `COMMON_MESSAGES`

### Booking State Module
- `SaveCabinSelectionDto` - Sử dụng `IsUUIDv7`, messages từ `COMMON_MESSAGES`
- `SaveSeatSelectionDto` - Sử dụng `IsUUIDv7`, messages từ `BOOKING_MESSAGES`, `COMMON_MESSAGES`

## Frontend Schemas - Đã Validate

### Auth Schemas
- `LoginSchema` - Đồng bộ với BE `LoginDto`
  - Email: required, valid email format
  - Password: required, 6-20 characters
- `RegisterSchema` - Đồng bộ với BE `RegisterDto`
  - Fullname: required, 2-100 characters
  - Email: required, valid email format
  - Password: required, 6-20 characters, strong password (uppercase, lowercase, number, special char)
  - Phone: required, Vietnamese phone format
  - RePassword: required, must match password

### Payment Schema
- `PaymentSchema` - Đồng bộ với BE `CreateBookingFromReservationDto`
  - FullName: required, 2-100 characters
  - Email: required, valid email format
  - Phone: required, Vietnamese phone format
  - DOB: required, DD/MM/YYYY format
  - Address: required
  - AcceptTerms: required, must be true

## Custom Validators

### Backend
- `IsUUIDv7` - Validate UUID v7 format với messages từ `COMMON_MESSAGES`
- `IsVietnamesePhone` - Validate Vietnamese phone với messages từ `AUTH_MESSAGES`
- `IsStrongPassword` - Validate strong password với messages từ `AUTH_MESSAGES`

### Frontend
- `VIETNAMESE_PHONE_REGEX` - Regex cho Vietnamese phone
- `STRONG_PASSWORD_REGEX` - Regex cho strong password
- `DATE_DD_MM_YYYY_REGEX` - Regex cho date format

## Validation Messages

### Backend Messages
- `AUTH_MESSAGES` - Tất cả messages cho Authentication
- `BOOKING_MESSAGES` - Tất cả messages cho Booking
- `PAYMENT_MESSAGES` - Tất cả messages cho Payment
- `SEARCH_MESSAGES` - Tất cả messages cho Search
- `RESERVATION_MESSAGES` - Tất cả messages cho Reservation
- `COMMON_MESSAGES` - Tất cả messages chung

### Frontend Messages
- `VALIDATION_MESSAGES` - Tất cả validation messages (đồng bộ với BE)

## Đồng bộ FE và BE

### Login
- BE: `LoginDto` - email, password (6-20)
- FE: `LoginSchema` - email, password (6-20)
- Messages: Đồng bộ

### Register
- BE: `RegisterDto` - fullname (2-100), email, password (strong, 6-20), phone (VN)
- FE: `RegisterSchema` - fullname (2-100), email, password (strong, 6-20), phone (VN)
- Messages: Đồng bộ

### Payment
- BE: `CreateBookingFromReservationDto` - contactFullname (optional, 2-100), contactEmail (optional, valid email), contactPhone (optional, VN)
- FE: `PaymentSchema` - fullName (required, 2-100), email (required, valid email), phone (required, VN)
- Messages: Đồng bộ

## Notes

1. **Login Form:** Đã cập nhật từ `identifier` (email/phone) sang `email` để đồng bộ với BE
2. **Password Strength:** FE và BE đều validate strong password với cùng requirements
3. **Phone Validation:** FE và BE đều sử dụng Vietnamese phone regex
4. **UUID v7:** Tất cả DTOs sử dụng `IsUUIDv7` thay vì `IsUUID` (v4)

## Testing Checklist

Khi test validation, đảm bảo:

- [ ] FE validation hoạt động đúng với các edge cases
- [ ] BE validation hoạt động đúng với các edge cases
- [ ] Messages hiển thị đúng và nhất quán giữa FE và BE
- [ ] Custom validators hoạt động đúng
- [ ] Validation không cho phép bypass từ FE
- [ ] Error messages rõ ràng và dễ hiểu

