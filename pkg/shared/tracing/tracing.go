package tracing

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
)

type contextKey string

const (
	traceIDKey contextKey = "trace_id"
	spanIDKey  contextKey = "span_id"
)

type Span struct {
	TraceID string
	SpanID  string
	Name    string
}

var (
	globalGenerator *IDGenerator
	once            sync.Once
)

func init() {
	once.Do(func() {
		globalGenerator = NewIDGenerator()
	})
}

type IDGenerator struct {
	mu sync.Mutex
}

func NewIDGenerator() *IDGenerator {
	return &IDGenerator{}
}

func (g *IDGenerator) generateTraceID() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

func (g *IDGenerator) generateSpanID() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

func GenerateTraceID() string {
	return globalGenerator.generateTraceID()
}

func GenerateSpanID() string {
	return globalGenerator.generateSpanID()
}

func StartSpan(ctx context.Context, name string, parent *Span) (context.Context, *Span) {
	var traceID string
	var spanID string

	if parent != nil {
		traceID = parent.TraceID
		spanID = GenerateSpanID()
	} else {
		traceID = GetTraceID(ctx)
		if traceID == "" {
			traceID = GenerateTraceID()
		}
		spanID = GenerateSpanID()
	}

	span := &Span{
		TraceID: traceID,
		SpanID:  spanID,
		Name:    name,
	}

	newCtx := context.WithValue(ctx, traceIDKey, traceID)
	newCtx = context.WithValue(newCtx, spanIDKey, spanID)
	newCtx = context.WithValue(newCtx, spanKey, span)

	return newCtx, span
}

func StartRootSpan(ctx context.Context, name string) (context.Context, *Span) {
	traceID := GenerateTraceID()
	spanID := GenerateSpanID()

	span := &Span{
		TraceID: traceID,
		SpanID:  spanID,
		Name:    name,
	}

	newCtx := context.WithValue(ctx, traceIDKey, traceID)
	newCtx = context.WithValue(newCtx, spanIDKey, spanID)
	newCtx = context.WithValue(newCtx, spanKey, span)

	return newCtx, span
}

type spanKey struct{}

func GetSpan(ctx context.Context) *Span {
	if span, ok := ctx.Value(spanKey{}).(*Span); ok {
		return span
	}
	return nil
}

func TraceID(ctx context.Context) string {
	if traceID, ok := ctx.Value(traceIDKey).(string); ok {
		return traceID
	}
	return ""
}

func SpanID(ctx context.Context) string {
	if spanID, ok := ctx.Value(spanIDKey).(string); ok {
		return spanID
	}
	return ""
}

func WithTrace(ctx context.Context, traceID, spanID string) context.Context {
	newCtx := context.WithValue(ctx, traceIDKey, traceID)
	newCtx = context.WithValue(newCtx, spanIDKey, spanID)
	return newCtx
}

func InjectHeaders(ctx context.Context) map[string]string {
	traceID := TraceID(ctx)
	spanID := SpanID(ctx)

	if traceID == "" {
		return nil
	}

	return map[string]string{
		"traceparent": fmt.Sprintf("00-%s-%s-01", traceID, spanID),
		"X-Trace-ID":  traceID,
	}
}

func ExtractFromHeaders(headers map[string]string) (traceID, spanID string) {
	traceID = headers["X-Trace-ID"]
	if traceID != "" {
		spanID = headers["X-Span-ID"]
		return
	}

	traceparent := headers["traceparent"]
	if traceparent == "" {
		return "", ""
	}

	var version, flags string
	fmt.Sscanf(traceparent, "%s-%s-%s-%s", &version, &traceID, &spanID, &flags)
	return
}

func ChildSpan(ctx context.Context, name string) (context.Context, *Span) {
	parent := GetSpan(ctx)
	return StartSpan(ctx, name, parent)
}
