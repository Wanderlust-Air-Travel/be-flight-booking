package redis

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"flight-booking/pkg/application/ports"
	"flight-booking/pkg/shared/logger"
)

// Config holds the configuration for the Redis client.
type Config struct {
	Host     string
	Port     int
	Password string
	DB       int
}

// Client wraps the Redis client.
type Client struct {
	*redis.Client
	log *logger.Logger
}

// NewClient creates a new Redis client.
func NewClient(cfg Config, log *logger.Logger) (*Client, error) {
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)

	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		client.Close()
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Info("Redis connection established", logger.Fields{
		"addr": addr,
		"db":   cfg.DB,
	})

	return &Client{
		Client: client,
		log:    log,
	}, nil
}

// Ensure Client implements ports.CachePort
var _ ports.CachePort = (*Client)(nil)

// Get retrieves a value from cache by key.
// Returns the value, a boolean indicating if the key exists, and any error.
func (c *Client) Get(ctx context.Context, key string) ([]byte, bool, error) {
	val, err := c.Client.Get(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, false, nil
		}
		c.log.Error("Redis GET error", logger.Fields{
			"key":   key,
			"error": err.Error(),
		})
		return nil, false, err
	}

	return val, true, nil
}

// Set stores a value in cache with TTL.
// If ttl is 0, the value is stored without expiration.
func (c *Client) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	var err error

	if ttl == 0 {
		err = c.Client.Set(ctx, key, value, 0).Err()
	} else {
		err = c.Client.SetEX(ctx, key, value, ttl).Err()
	}

	if err != nil {
		c.log.Error("Redis SET error", logger.Fields{
			"key":   key,
			"ttl":   ttl.String(),
			"error": err.Error(),
		})
		return err
	}

	c.log.Debug("Redis SET success", logger.Fields{
		"key": key,
		"ttl": ttl.String(),
	})

	return nil
}

// Delete removes a value from cache.
func (c *Client) Delete(ctx context.Context, key string) error {
	err := c.Client.Del(ctx, key).Err()
	if err != nil {
		c.log.Error("Redis DELETE error", logger.Fields{
			"key":   key,
			"error": err.Error(),
		})
		return err
	}

	c.log.Debug("Redis DELETE success", logger.Fields{
		"key": key,
	})

	return nil
}

// Exists checks if a key exists in cache.
func (c *Client) Exists(ctx context.Context, key string) (bool, error) {
	count, err := c.Client.Exists(ctx, key).Result()
	if err != nil {
		c.log.Error("Redis EXISTS error", logger.Fields{
			"key":   key,
			"error": err.Error(),
		})
		return false, err
	}

	return count > 0, nil
}

// Close closes the Redis connection.
func (c *Client) Close() error {
	c.log.Info("Closing Redis connection", nil)
	return c.Client.Close()
}

// ============================================================================
// Additional Helper Methods
// ============================================================================

// SetNX sets a value only if the key does not exist (atomic operation).
func (c *Client) SetNX(ctx context.Context, key string, value []byte, ttl time.Duration) (bool, error) {
	result, err := c.Client.SetNX(ctx, key, value, ttl).Result()
	if err != nil {
		c.log.Error("Redis SETNX error", logger.Fields{
			"key":   key,
			"error": err.Error(),
		})
		return false, err
	}
	return result, nil
}

// Incr increments the integer value of a key by 1.
func (c *Client) Incr(ctx context.Context, key string) (int64, error) {
	result, err := c.Client.Incr(ctx, key).Result()
	if err != nil {
		c.log.Error("Redis INCR error", logger.Fields{
			"key":   key,
			"error": err.Error(),
		})
		return 0, err
	}
	return result, nil
}

// Decr decrements the integer value of a key by 1.
func (c *Client) Decr(ctx context.Context, key string) (int64, error) {
	result, err := c.Client.Decr(ctx, key).Result()
	if err != nil {
		c.log.Error("Redis DECR error", logger.Fields{
			"key":   key,
			"error": err.Error(),
		})
		return 0, err
	}
	return result, nil
}

// Expire sets a timeout on a key.
func (c *Client) Expire(ctx context.Context, key string, ttl time.Duration) (bool, error) {
	result, err := c.Client.Expire(ctx, key, ttl).Result()
	if err != nil {
		c.log.Error("Redis EXPIRE error", logger.Fields{
			"key":   key,
			"ttl":   ttl.String(),
			"error": err.Error(),
		})
		return false, err
	}
	return result, nil
}

// TTL returns the remaining time-to-live of a key.
func (c *Client) TTL(ctx context.Context, key string) (time.Duration, error) {
	result, err := c.Client.TTL(ctx, key).Result()
	if err != nil {
		c.log.Error("Redis TTL error", logger.Fields{
			"key":   key,
			"error": err.Error(),
		})
		return 0, err
	}
	return result, nil
}

// Keys returns all keys matching a pattern.
func (c *Client) Keys(ctx context.Context, pattern string) ([]string, error) {
	result, err := c.Client.Keys(ctx, pattern).Result()
	if err != nil {
		c.log.Error("Redis KEYS error", logger.Fields{
			"pattern": pattern,
			"error":   err.Error(),
		})
		return nil, err
	}
	return result, nil
}

// FlushDB deletes all keys in the current database.
func (c *Client) FlushDB(ctx context.Context) error {
	err := c.Client.FlushDB(ctx).Err()
	if err != nil {
		c.log.Error("Redis FLUSHDB error", logger.Fields{
			"error": err.Error(),
		})
		return err
	}
	c.log.Info("Redis FLUSHDB success", nil)
	return nil
}

// Publish publishes a message to a channel.
func (c *Client) Publish(ctx context.Context, channel string, message interface{}) (int64, error) {
	result, err := c.Client.Publish(ctx, channel, message).Result()
	if err != nil {
		c.log.Error("Redis PUBLISH error", logger.Fields{
			"channel": channel,
			"error":   err.Error(),
		})
		return 0, err
	}
	return result, nil
}

// Subscribe subscribes to a channel.
func (c *Client) Subscribe(ctx context.Context, channels ...string) *redis.PubSub {
	return c.Client.Subscribe(ctx, channels...)
}

// ============================================================================
// Distributed Lock Support
// ============================================================================

// Lock represents a distributed lock.
type Lock struct {
	client *Client
	key    string
	value  string
	ttl    time.Duration
}

// NewLock creates a new lock instance.
func (c *Client) NewLock(key string, value string, ttl time.Duration) *Lock {
	return &Lock{
		client: c,
		key:    key,
		value:  value,
		ttl:    ttl,
	}
}

// Acquire attempts to acquire the lock.
func (l *Lock) Acquire(ctx context.Context) (bool, error) {
	result, err := l.client.SetNX(ctx, l.key, []byte(l.value), l.ttl).Result()
	if err != nil {
		return false, err
	}
	return result, nil
}

// Release releases the lock.
func (l *Lock) Release(ctx context.Context) error {
	// Use Lua script to ensure we only delete the key if the value matches
	script := redis.NewScript(`
		if redis.call("GET", KEYS[1]) == ARGV[1] then
			return redis.call("DEL", KEYS[1])
		else
			return 0
		end
	`)

	_, err := script.Run(ctx, l.client.Client, []string{l.key}, l.value).Result()
	return err
}

// Extend extends the lock's TTL.
func (l *Lock) Extend(ctx context.Context) (bool, error) {
	// Use Lua script to extend TTL only if the value matches
	script := redis.NewScript(`
		if redis.call("GET", KEYS[1]) == ARGV[1] then
			return redis.call("PEXPIRE", KEYS[1], ARGV[2])
		else
			return 0
		end
	`)

	result, err := script.Run(ctx, l.client.Client, []string{l.key}, l.value, l.ttl.Milliseconds()).Int64()
	if err != nil {
		return false, err
	}
	return result == 1, nil
}
