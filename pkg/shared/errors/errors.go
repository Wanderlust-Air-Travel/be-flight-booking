package errors

import (
	"fmt"
	"net/http"
)

type Code string

const (
	NOT_FOUND           Code = "NOT_FOUND"
	VALIDATION_FAILED   Code = "VALIDATION_FAILED"
	UNAUTHORIZED        Code = "UNAUTHORIZED"
	FORBIDDEN           Code = "FORBIDDEN"
	BAD_REQUEST         Code = "BAD_REQUEST"
	INTERNAL_ERROR      Code = "INTERNAL_ERROR"
	PAYMENT_FAILED      Code = "PAYMENT_FAILED"
	SEAT_UNAVAILABLE    Code = "SEAT_UNAVAILABLE"
	BOOKING_EXPIRED     Code = "BOOKING_EXPIRED"
	EXTERNAL_API_ERROR  Code = "EXTERNAL_API_ERROR"
	TOO_MANY_REQUESTS   Code = "TOO_MANY_REQUESTS"
)

var codeToHTTPStatus = map[Code]int{
	NOT_FOUND:          http.StatusNotFound,
	VALIDATION_FAILED: http.StatusUnprocessableEntity,
	UNAUTHORIZED:       http.StatusUnauthorized,
	FORBIDDEN:          http.StatusForbidden,
	BAD_REQUEST:       http.StatusBadRequest,
	INTERNAL_ERROR:     http.StatusInternalServerError,
	PAYMENT_FAILED:     http.StatusPaymentRequired,
	SEAT_UNAVAILABLE:   http.StatusConflict,
	BOOKING_EXPIRED:    http.StatusGone,
	EXTERNAL_API_ERROR: http.StatusBadGateway,
	TOO_MANY_REQUESTS:  http.StatusTooManyRequests,
}

type AppError struct {
	Code       Code     `json:"code"`
	HTTPStatus int      `json:"-"`
	Message    string   `json:"message"`
	Detail     string   `json:"detail,omitempty"`
	Err        error    `json:"-"`
	Fields     []string `json:"fields,omitempty"`
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s (%v)", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *AppError) Unwrap() error {
	return e.Err
}

func (e *AppError) WithFields(fields []string) *AppError {
	e.Fields = fields
	return e
}

func (e *AppError) WithDetail(detail string) *AppError {
	e.Detail = detail
	return e
}

func (e *AppError) Wrap(err error) *AppError {
	e.Err = err
	return e
}

func NewAppError(code Code, message string) *AppError {
	return &AppError{
		Code:       code,
		HTTPStatus: codeToHTTPStatus[code],
		Message:    message,
	}
}

func NotFound(message string) *AppError {
	return NewAppError(NOT_FOUND, message)
}

func BadRequest(message string) *AppError {
	return NewAppError(BAD_REQUEST, message)
}

func ValidationFailed(message string) *AppError {
	return NewAppError(VALIDATION_FAILED, message)
}

func Unauthorized(message string) *AppError {
	return NewAppError(UNAUTHORIZED, message)
}

func Forbidden(message string) *AppError {
	return NewAppError(FORBIDDEN, message)
}

func Internal(message string) *AppError {
	return NewAppError(INTERNAL_ERROR, message)
}

func ExternalAPI(message string) *AppError {
	return NewAppError(EXTERNAL_API_ERROR, message)
}

func PaymentFailed(message string) *AppError {
	return NewAppError(PAYMENT_FAILED, message)
}

func SeatUnavailable(message string) *AppError {
	return NewAppError(SEAT_UNAVAILABLE, message)
}

func BookingExpired(message string) *AppError {
	return NewAppError(BOOKING_EXPIRED, message)
}

func TooManyRequests(message string) *AppError {
	return NewAppError(TOO_MANY_REQUESTS, message)
}

func FromError(err error) *AppError {
	if err == nil {
		return nil
	}
	if appErr, ok := err.(*AppError); ok {
		return appErr
	}
	return Internal(err.Error()).Wrap(err)
}

func IsAppError(err error) bool {
	_, ok := err.(*AppError)
	return ok
}

func IsCode(err error, code Code) bool {
	var appErr *AppError
	if err == nil {
		return false
	}
	if appErr, ok := err.(*AppError); ok {
		return appErr.Code == code
	}
	return false
}
