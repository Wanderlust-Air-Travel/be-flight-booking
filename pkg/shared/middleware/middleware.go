package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"flight-booking/pkg/shared/config"
	"flight-booking/pkg/shared/errors"
	"flight-booking/pkg/shared/logger"
	"flight-booking/pkg/shared/tracing"

	"github.com/golang-jwt/jwt/v5"
)

const (
	RequestIDHeader = "X-Request-ID"
	TraceIDHeader   = "X-Trace-ID"
	SpanIDHeader    = "X-Span-ID"
	UserIDKey       = "user_id"
	UserRoleKey     = "user_role"
	StartTimeKey    = "start_time"
)

var requestIDRegex = regexp.MustCompile(`^[a-zA-Z0-9\-_]+$`)

type contextKey string

const contextKeyRequestID contextKey = "request_id"

func GetRequestID(ctx context.Context) string {
	if rid, ok := ctx.Value(contextKeyRequestID).(string); ok {
		return rid
	}
	return ""
}

type TracingMiddleware struct {
	log *logger.Logger
}

func NewTracingMiddleware(log *logger.Logger) *TracingMiddleware {
	return &TracingMiddleware{log: log}
}

func (m *TracingMiddleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		traceID := r.Header.Get(TraceIDHeader)
		if traceID == "" {
			traceID = tracing.GenerateTraceID()
		}

		spanID := r.Header.Get(SpanIDHeader)
		if spanID == "" {
			spanID = tracing.GenerateSpanID()
		}

		requestID := r.Header.Get(RequestIDHeader)
		if requestID == "" {
			requestID = generateRequestID()
		}

		w.Header().Set(RequestIDHeader, requestID)
		w.Header().Set(TraceIDHeader, traceID)

		ctx := tracing.WithTrace(r.Context(), traceID, spanID)
		ctx = context.WithValue(ctx, contextKeyRequestID, requestID)
		ctx = context.WithValue(ctx, StartTimeKey, start)

		span, _ := tracing.StartSpan(ctx, fmt.Sprintf("%s %s", r.Method, r.URL.Path), nil)

		r = r.WithContext(ctx)

		log := m.log.WithTrace(traceID, spanID)

		wrapper := &responseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
			requestID:      requestID,
		}

		next.ServeHTTP(wrapper, r)

		latency := time.Since(start)

		logFields := logger.Fields{
			"method":      r.Method,
			"path":         r.URL.Path,
			"status":      wrapper.statusCode,
			"latency_ms":  latency.Milliseconds(),
			"ip":          getClientIP(r),
			"user_agent":  r.UserAgent(),
		}

		if span != nil {
			logFields["span_id"] = span.SpanID
		}

		if wrapper.statusCode >= http.StatusInternalServerError {
			log.Error("request completed with error", logFields)
		} else if wrapper.statusCode >= http.StatusBadRequest {
			log.Warn("request completed with client error", logFields)
		} else {
			log.Info("request completed", logFields)
		}
	})
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
	requestID  string
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func generateRequestID() string {
	bytes := make([]byte, 16)
	randRead(bytes)
	return fmt.Sprintf("%x", bytes)
}

func randRead(b []byte) {
	for i := range b {
		b[i] = byte(time.Now().UnixNano() & 0xFF)
		time.Sleep(time.Nanosecond)
	}
}

func getClientIP(r *http.Request) string {
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	xri := r.Header.Get("X-Real-IP")
	if xri != "" {
		return xri
	}
	return r.RemoteAddr
}

type RecoverMiddleware struct {
	log *logger.Logger
}

func NewRecoverMiddleware(log *logger.Logger) *RecoverMiddleware {
	return &RecoverMiddleware{log: log}
}

func (m *RecoverMiddleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				requestID := GetRequestID(r.Context())
				m.log.WithTrace(
					tracing.TraceID(r.Context()),
					tracing.SpanID(r.Context()),
				).Error("panic recovered", logger.Fields{
					"error":      fmt.Sprintf("%v", err),
					"request_id": requestID,
					"path":       r.URL.Path,
					"method":     r.Method,
				})

				respondError(w, r, errors.Internal("internal server error"))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

type CORSConfig struct {
	AllowedOrigins   []string
	AllowedMethods   []string
	AllowedHeaders   []string
	ExposeHeaders    []string
	MaxAge           int
	AllowCredentials bool
}

type CORSMiddleware struct {
	cfg CORSConfig
}

func NewCORSMiddleware(cfg CORSConfig) *CORSMiddleware {
	return &CORSMiddleware{cfg: cfg}
}

func (m *CORSMiddleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		if m.isOriginAllowed(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			if m.cfg.AllowCredentials {
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}
			if len(m.cfg.ExposeHeaders) > 0 {
				w.Header().Set("Access-Control-Expose-Headers", strings.Join(m.cfg.ExposeHeaders, ","))
			}
		}

		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", strings.Join(m.cfg.AllowedMethods, ","))
			w.Header().Set("Access-Control-Allow-Headers", strings.Join(m.cfg.AllowedHeaders, ","))
			w.Header().Set("Access-Control-Max-Age", fmt.Sprintf("%d", m.cfg.MaxAge))
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (m *CORSMiddleware) isOriginAllowed(origin string) bool {
	if origin == "" {
		return true
	}
	for _, allowed := range m.cfg.AllowedOrigins {
		if allowed == "*" || allowed == origin {
			return true
		}
		if strings.HasSuffix(allowed, "*") {
			prefix := strings.TrimSuffix(allowed, "*")
			if strings.HasPrefix(origin, prefix) {
				return true
			}
		}
	}
	return false
}

type TokenBucket struct {
	mu       sync.Mutex
	tokens   float64
	maxTokens float64
	rate     float64
	lastRefill time.Time
}

func NewTokenBucket(maxTokens, refillPerMinute int) *TokenBucket {
	return &TokenBucket{
		tokens:     float64(maxTokens),
		maxTokens:  float64(maxTokens),
		rate:       float64(maxTokens) / float64(refillPerMinute) / 60.0,
		lastRefill: time.Now(),
	}
}

func (tb *TokenBucket) Allow() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	tb.refill()

	if tb.tokens >= 1 {
		tb.tokens--
		return true
	}
	return false
}

func (tb *TokenBucket) refill() {
	now := time.Now()
	elapsed := now.Sub(tb.lastRefill).Seconds()
	tb.tokens += elapsed * tb.rate
	if tb.tokens > tb.maxTokens {
		tb.tokens = tb.maxTokens
	}
	tb.lastRefill = now
}

type RateLimiterMiddleware struct {
	buckets    map[string]*TokenBucket
	mu         sync.RWMutex
	burst      int
	refillRate int
}

func NewRateLimiterMiddleware(requestsPerMinute, burst int) *RateLimiterMiddleware {
	return &RateLimiterMiddleware{
		buckets:    make(map[string]*TokenBucket),
		burst:      burst,
		refillRate: requestsPerMinute,
	}
}

func (m *RateLimiterMiddleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := getClientIP(r)

		if !m.Allow(ip) {
			respondError(w, r, errors.TooManyRequests("rate limit exceeded"))
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (m *RateLimiterMiddleware) Allow(ip string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	bucket, exists := m.buckets[ip]
	if !exists {
		bucket = NewTokenBucket(m.burst, m.refillRate)
		m.buckets[ip] = bucket
	}

	return bucket.Allow()
}

func (m *RateLimiterMiddleware) CleanupInactive(maxAge time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	for ip, bucket := range m.buckets {
		bucket.mu.Lock()
		if now.Sub(bucket.lastRefill) > maxAge {
			delete(m.buckets, ip)
		}
		bucket.mu.Unlock()
	}
}

type JWTAuthMiddleware struct {
	secret          []byte
	publicPaths     []*regexp.Regexp
}

func NewJWTAuthMiddleware(secret string, publicPaths []string) *JWTAuthMiddleware {
	patterns := make([]*regexp.Regexp, len(publicPaths))
	for i, p := range publicPaths {
		patterns[i] = regexp.MustCompile(p)
	}
	return &JWTAuthMiddleware{
		secret:      []byte(secret),
		publicPaths: patterns,
	}
}

func (m *JWTAuthMiddleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if m.isPublicEndpoint(r.Method, r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			respondError(w, r, errors.Unauthorized("missing authorization header"))
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			respondError(w, r, errors.Unauthorized("invalid authorization header format"))
			return
		}

		tokenString := parts[1]

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return m.secret, nil
		})

		if err != nil || !token.Valid {
			respondError(w, r, errors.Unauthorized("invalid token"))
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			respondError(w, r, errors.Unauthorized("invalid token claims"))
			return
		}

		ctx := r.Context()

		if userID, ok := claims["sub"].(string); ok {
			ctx = context.WithValue(ctx, UserIDKey, userID)
		}

		if role, ok := claims["role"].(string); ok {
			ctx = context.WithValue(ctx, UserRoleKey, role)
		}

		r = r.WithContext(ctx)

		next.ServeHTTP(w, r)
	})
}

func (m *JWTAuthMiddleware) isPublicEndpoint(method, path string) bool {
	for _, pattern := range m.publicPaths {
		if pattern.MatchString(path) {
			return true
		}
	}
	return false
}

func isPublicEndpoint(method, path string) bool {
	publicMethods := map[string]bool{
		http.MethodOptions: true,
		http.MethodGet:      true,
	}

	if !publicMethods[method] {
		return false
	}

	publicPaths := []string{
		`^/health`,
		`^/ready`,
		`^/metrics`,
		`^/api/v1/auth/login`,
		`^/api/v1/auth/register`,
		`^/api/v1/flights/search`,
	}

	for _, p := range publicPaths {
		if matched, _ := regexp.MatchString(p, path); matched {
			return true
		}
	}

	return false
}

type TimeoutMiddleware struct {
	timeout time.Duration
}

func NewTimeoutMiddleware(timeout time.Duration) *TimeoutMiddleware {
	return &TimeoutMiddleware{timeout: timeout}
}

func (m *TimeoutMiddleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), m.timeout)
		defer cancel()

		done := make(chan struct{})

		go func() {
			next.ServeHTTP(w, r.WithContext(ctx))
			close(done)
		}()

		select {
		case <-done:
			return
		case <-ctx.Done():
			respondError(w, r, errors.Internal("request timeout"))
		}
	})
}

type PaginationParams struct {
	Page     int
	PageSize int
	Offset   int
	Limit    int
}

type PaginationMiddleware struct {
	defaultPageSize int
	maxPageSize     int
}

func NewPaginationMiddleware(defaultPageSize, maxPageSize int) *PaginationMiddleware {
	return &PaginationMiddleware{
		defaultPageSize: defaultPageSize,
		maxPageSize:     maxPageSize,
	}
}

func (m *PaginationMiddleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		page := parseIntParam(r.URL.Query().Get("page"), 1)
		pageSize := parseIntParam(r.URL.Query().Get("page_size"), m.defaultPageSize)

		if page < 1 {
			page = 1
		}
		if pageSize < 1 {
			pageSize = m.defaultPageSize
		}
		if pageSize > m.maxPageSize {
			pageSize = m.maxPageSize
		}

		offset := (page - 1) * pageSize

		params := PaginationParams{
			Page:     page,
			PageSize: pageSize,
			Offset:   offset,
			Limit:    pageSize,
		}

		ctx := context.WithValue(r.Context(), "pagination", params)
		r = r.WithContext(ctx)

		next.ServeHTTP(w, r)
	})
}

func parseIntParam(s string, fallback int) int {
	if s == "" {
		return fallback
	}
	var n int
	fmt.Sscanf(s, "%d", &n)
	return n
}

func GetPagination(ctx context.Context) PaginationParams {
	if p, ok := ctx.Value("pagination").(PaginationParams); ok {
		return p
	}
	return PaginationParams{Page: 1, PageSize: 20}
}

func respondError(w http.ResponseWriter, r *http.Request, err *errors.AppError) {
	requestID := GetRequestID(r.Context())

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(err.HTTPStatus)

	resp := map[string]interface{}{
		"code":    err.Code,
		"message": err.Message,
	}
	if err.Detail != "" {
		resp["detail"] = err.Detail
	}
	if len(err.Fields) > 0 {
		resp["fields"] = err.Fields
	}
	resp["request_id"] = requestID

	json.NewEncoder(w).Encode(resp)
}

func RequestLogger(log *logger.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			ctx := r.Context()
			traceID := tracing.TraceID(ctx)
			spanID := tracing.SpanID(ctx)

			reqLog := log.WithTrace(traceID, spanID)

			if r.Body != nil {
				var bodyBytes []byte
				bodyBytes, _ = io.ReadAll(r.Body)
				r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

				if len(bodyBytes) > 0 && len(bodyBytes) < 1000 {
					reqLog.Debug("request body", logger.Fields{"body": string(bodyBytes)})
				}
			}

			wrapper := &responseWriter{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
				requestID:      GetRequestID(ctx),
			}

			next.ServeHTTP(wrapper, r)

			latency := time.Since(start)

			reqLog.Info("http request", logger.Fields{
				"method":      r.Method,
				"path":        r.URL.Path,
				"status":      wrapper.statusCode,
				"latency_ms":  latency.Milliseconds(),
				"ip":          getClientIP(r),
				"user_agent":  r.UserAgent(),
				"request_id":  wrapper.requestID,
			})
		})
	}
}

func BuildMiddlewareStack(cfg *config.Config, log *logger.Logger) []func(http.Handler) http.Handler {
	middlewares := []func(http.Handler) http.Handler{}

	middlewares = append(middlewares,
		NewTracingMiddleware(log).Handler,
		NewRecoverMiddleware(log).Handler,
		NewCORSMiddleware(CORSConfig{
			AllowedOrigins:   cfg.CORS.AllowedOrigins,
			AllowedMethods:   cfg.CORS.AllowedMethods,
			AllowedHeaders:   cfg.CORS.AllowedHeaders,
			ExposeHeaders:    cfg.CORS.ExposeHeaders,
			MaxAge:           cfg.CORS.MaxAge,
			AllowCredentials: cfg.CORS.AllowCredentials,
		}).Handler,
		NewRateLimiterMiddleware(cfg.RateLimit.RequestsPerMinute, cfg.RateLimit.Burst).Handler,
		NewJWTAuthMiddleware(cfg.JWT.Secret, []string{
			`^/health`,
			`^/ready`,
			`^/metrics`,
			`^/api/v1/auth/.*`,
			`^/api/v1/flights/search`,
		}).Handler,
		NewTimeoutMiddleware(30*time.Second).Handler,
		NewPaginationMiddleware(20, 100).Handler,
		RequestLogger(log),
	)

	return middlewares
}

func ApplyMiddleware(handler http.Handler, middlewares ...func(http.Handler) http.Handler) http.Handler {
	for i := len(middlewares) - 1; i >= 0; i-- {
		handler = middlewares[i](handler)
	}
	return handler
}
