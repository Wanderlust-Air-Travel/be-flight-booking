package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	App       AppConfig
	DB        DBConfig
	Redis     RedisConfig
	RabbitMQ  RabbitMQConfig
	Aviation  AviationConfig
	Payment   PaymentConfig
	JWT       JWTConfig
	CORS      CORSConfig
	RateLimit RateLimitConfig
	Log       LogConfig
}

type AppConfig struct {
	Env             string
	Name            string
	Version         string
	GatewayPort     int
	SearchPort      int
	BookingPort     int
	PaymentPort     int
	GRPCPort        int
}

type DBConfig struct {
	Host            string
	Port            int
	Name            string
	User            string
	Password        string
	SSLMode         string
	MaxConns        int
	IdleConns       int
	ConnMaxLifetime int
}

func (d *DBConfig) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d dbname=%s user=%s password=%s sslmode=%s",
		d.Host, d.Port, d.Name, d.User, d.Password, d.SSLMode,
	)
}

func (d *DBConfig) DSNWithPool() string {
	return fmt.Sprintf(
		"host=%s port=%d dbname=%s user=%s password=%s sslmode=%s pool_max_conns=%d pool_min_conns=%d",
		d.Host, d.Port, d.Name, d.User, d.Password, d.SSLMode, d.MaxConns, d.IdleConns,
	)
}

type RedisConfig struct {
	Host            string
	Port            int
	Password        string
	DB              int
	FlightCacheTTL  int
	SessionTTL      int
}

func (r *RedisConfig) Addr() string {
	return fmt.Sprintf("%s:%d", r.Host, r.Port)
}

type RabbitMQConfig struct {
	Host       string
	Port       int
	User       string
	Password   string
	VHost      string
	Exchange   string
	Prefetch   int
}

func (r *RabbitMQConfig) URL() string {
	return fmt.Sprintf("amqp://%s:%s@%s:%d%s",
		r.User, r.Password, r.Host, r.Port, r.VHost)
}

type AviationConfig struct {
	APIKey        string
	BaseURL       string
	Timeout       int
	RetryAttempts int
	CacheTTL      int
}

type PaymentConfig struct {
	Provider     string
	MockEnabled  bool
}

type JWTConfig struct {
	Secret       string
	ExpiryHours  int
}

type CORSConfig struct {
	AllowedOrigins   []string
	AllowedMethods   []string
	AllowedHeaders   []string
	ExposeHeaders    []string
	MaxAge           int
	AllowCredentials bool
}

type RateLimitConfig struct {
	RequestsPerMinute int
	Burst             int
}

type LogConfig struct {
	Level  string
	Format string
}

var globalConfig *Config

func Load() (*Config, error) {
	if err := godotenv.Load(); err != nil {
		// .env file is optional in production
	}
	if err := godotenv.Load(".env.local"); err != nil {
		// .env.local is optional
	}

	cfg := &Config{
		App: AppConfig{
			Env:         get("APP_ENV", "development"),
			Name:        get("APP_NAME", "flight-booking"),
			Version:     get("VERSION", "1.0.0"),
			GatewayPort: getInt("API_GATEWAY_PORT", 8080),
			SearchPort:  getInt("SEARCH_SERVICE_PORT", 8090),
			BookingPort: getInt("BOOKING_SERVICE_PORT", 8091),
			PaymentPort: getInt("PAYMENT_SERVICE_PORT", 8092),
			GRPCPort:    getInt("GRPC_PORT", 50051),
		},
		DB: DBConfig{
			Host:            get("DB_HOST", "localhost"),
			Port:            getInt("DB_PORT", 5432),
			Name:            get("DB_NAME", "flightbooking"),
			User:            get("DB_USER", "flightbooking"),
			Password:        get("DB_PASSWORD", ""),
			SSLMode:         get("DB_SSLMODE", "disable"),
			MaxConns:        getInt("DB_MAX_CONNECTIONS", 25),
			IdleConns:       getInt("DB_IDLE_CONNECTIONS", 5),
			ConnMaxLifetime: getInt("DB_CONNECTION_LIFETIME", 300),
		},
		Redis: RedisConfig{
			Host:           get("REDIS_HOST", "localhost"),
			Port:           getInt("REDIS_PORT", 6379),
			Password:       get("REDIS_PASSWORD", ""),
			DB:             getInt("REDIS_DB", 0),
			FlightCacheTTL: getInt("REDIS_FLIGHT_CACHE_TTL", 900),
			SessionTTL:     getInt("REDIS_SESSION_TTL", 3600),
		},
		RabbitMQ: RabbitMQConfig{
			Host:     get("RABBITMQ_HOST", "localhost"),
			Port:     getInt("RABBITMQ_PORT", 5672),
			User:     get("RABBITMQ_USER", "guest"),
			Password: get("RABBITMQ_PASSWORD", "guest"),
			VHost:    get("RABBITMQ_VHOST", "/"),
			Exchange: get("RABBITMQ_EXCHANGE", "flightbooking.events"),
			Prefetch: getInt("RABBITMQ_PREFETCH", 10),
		},
		Aviation: AviationConfig{
			APIKey:        get("AVIATIONSTACK_API_KEY", ""),
			BaseURL:       get("AVIATIONSTACK_BASE_URL", "https://api.aviationstack.com/v1"),
			Timeout:       getInt("AVIATIONSTACK_TIMEOUT", 10),
			RetryAttempts: getInt("AVIATIONSTACK_RETRY_ATTEMPTS", 3),
			CacheTTL:      getInt("AVIATIONSTACK_CACHE_TTL", 900),
		},
		Payment: PaymentConfig{
			Provider:    get("PAYMENT_PROVIDER", "mock"),
			MockEnabled: getBool("PAYMENT_MOCK_ENABLED", true),
		},
		JWT: JWTConfig{
			Secret:      get("JWT_SECRET", ""),
			ExpiryHours: getInt("JWT_EXPIRY_HOURS", 24),
		},
		CORS: CORSConfig{
			AllowedOrigins:   parseCSV(get("CORS_ALLOWED_ORIGINS", "http://localhost:3000")),
			AllowedMethods:   parseCSV(get("CORS_ALLOWED_METHODS", "GET,POST,PUT,PATCH,DELETE,OPTIONS")),
			AllowedHeaders:   parseCSV(get("CORS_ALLOWED_HEADERS", "Authorization,Content-Type,X-Requested-With,X-Request-ID")),
			ExposeHeaders:    parseCSV(get("CORS_EXPOSE_HEADERS", "X-Total-Count,X-Request-ID")),
			MaxAge:           getInt("CORS_MAX_AGE", 86400),
			AllowCredentials: getBool("CORS_ALLOW_CREDENTIALS", true),
		},
		RateLimit: RateLimitConfig{
			RequestsPerMinute: getInt("RATE_LIMIT_REQUESTS_PER_MINUTE", 100),
			Burst:             getInt("RATE_LIMIT_BURST", 20),
		},
		Log: LogConfig{
			Level:  get("LOG_LEVEL", "info"),
			Format: get("LOG_FORMAT", "json"),
		},
	}

	globalConfig = cfg
	return cfg, nil
}

func Get() *Config {
	if globalConfig == nil {
		panic("config not loaded, call Load() first")
	}
	return globalConfig
}

func (c *Config) IsDevelopment() bool {
	return c.App.Env == "development" || c.App.Env == "dev" || c.App.Env == ""
}

func (c *Config) IsProduction() bool {
	return c.App.Env == "production" || c.App.Env == "prod"
}

func (c *Config) IsTest() bool {
	return c.App.Env == "test" || c.App.Env == "testing"
}

func get(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getInt(key string, fallback int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return fallback
}

func getBool(key string, fallback bool) bool {
	if val := os.Getenv(key); val != "" {
		lower := strings.ToLower(val)
		if lower == "true" || lower == "1" || lower == "yes" {
			return true
		}
		if lower == "false" || lower == "0" || lower == "no" {
			return false
		}
	}
	return fallback
}

func parseCSV(value string) []string {
	if value == "" {
		return []string{}
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}
