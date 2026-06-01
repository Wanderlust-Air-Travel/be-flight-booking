package logger

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sync"
	"time"
)

type Level int

const (
	DEBUG Level = iota
	INFO
	WARN
	ERROR
	FATAL
)

var levelNames = map[Level]string{
	DEBUG: "DEBUG",
	INFO:  "INFO",
	WARN:  "WARN",
	ERROR: "ERROR",
	FATAL: "FATAL",
}

var levelFromString = map[string]Level{
	"debug": DEBUG,
	"info":  INFO,
	"warn":  WARN,
	"error": ERROR,
	"fatal": FATAL,
}

func ParseLevel(s string) Level {
	if l, ok := levelFromString[s]; ok {
		return l
	}
	return INFO
}

type Fields map[string]interface{}

func F(keyvals ...interface{}) Fields {
	f := Fields{}
	for i := 0; i < len(keyvals)-1; i += 2 {
		if key, ok := keyvals[i].(string); ok {
			f[key] = keyvals[i+1]
		}
	}
	return f
}

type Logger struct {
	mu      sync.Mutex
	service string
	format  string
	level   Level
	out     io.Writer
}

type logEntry struct {
	Time    string                 `json:"time"`
	Level   string                 `json:"level"`
	Service string                 `json:"service"`
	Message string                 `json:"message"`
	TraceID string                 `json:"trace_id,omitempty"`
	SpanID  string                 `json:"span_id,omitempty"`
	Fields  map[string]interface{} `json:"fields,omitempty"`
}

func New(service string, format string, level string) *Logger {
	return &Logger{
		service: service,
		format:  format,
		level:   ParseLevel(level),
		out:     os.Stdout,
	}
}

func NewWithWriter(service string, format string, level string, w io.Writer) *Logger {
	return &Logger{
		service: service,
		format:  format,
		level:   ParseLevel(level),
		out:     w,
	}
}

func (l *Logger) SetOutput(w io.Writer) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.out = w
}

func (l *Logger) SetLevel(level string) {
	l.level = ParseLevel(level)
}

func (l *Logger) shouldLog(level Level) bool {
	return level >= l.level
}

func (l *Logger) log(level Level, msg string, fields Fields) {
	if !l.shouldLog(level) {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	entry := logEntry{
		Time:    time.Now().UTC().Format(time.RFC3339Nano),
		Level:   levelNames[level],
		Service: l.service,
		Message: msg,
	}

	if fields != nil {
		entry.Fields = fields
		if traceID, ok := fields["trace_id"].(string); ok && traceID != "" {
			entry.TraceID = traceID
		}
		if spanID, ok := fields["span_id"].(string); ok && spanID != "" {
			entry.SpanID = spanID
		}
	}

	if l.format == "json" {
		data, _ := json.Marshal(entry)
		fmt.Fprintln(l.out, string(data))
	} else {
		l.writePretty(entry)
	}
}

func (l *Logger) writePretty(entry logEntry) {
	ts := entry.Time
	msg := fmt.Sprintf("%s %s %-5s [%s] %s",
		ts[:23],
		levelNames[ParseLevel(entry.Level)],
		"",
		l.service,
		entry.Message,
	)

	if len(entry.Fields) > 0 {
		pairs := make([]string, 0, len(entry.Fields))
		for k, v := range entry.Fields {
			if k == "trace_id" || k == "span_id" {
				continue
			}
			pairs = append(pairs, fmt.Sprintf("%s=%v", k, v))
		}
		if len(pairs) > 0 {
			msg += " " + joinFields(pairs)
		}
	}

	fmt.Fprintln(l.out, msg)
}

func joinFields(pairs []string) string {
	result := "{"
	for i, p := range pairs {
		if i > 0 {
			result += " "
		}
		result += p
	}
	result += "}"
	return result
}

func (l *Logger) Debug(msg string, fields Fields) {
	l.log(DEBUG, msg, fields)
}

func (l *Logger) Debugf(format string, args ...interface{}) {
	l.log(DEBUG, fmt.Sprintf(format, args...), nil)
}

func (l *Logger) Info(msg string, fields Fields) {
	l.log(INFO, msg, fields)
}

func (l *Logger) Infof(format string, args ...interface{}) {
	l.log(INFO, fmt.Sprintf(format, args...), nil)
}

func (l *Logger) Warn(msg string, fields Fields) {
	l.log(WARN, msg, fields)
}

func (l *Logger) Warnf(format string, args ...interface{}) {
	l.log(WARN, fmt.Sprintf(format, args...), nil)
}

func (l *Logger) Error(msg string, fields Fields) {
	l.log(ERROR, msg, fields)
}

func (l *Logger) Errorf(format string, args ...interface{}) {
	l.log(ERROR, fmt.Sprintf(format, args...), nil)
}

func (l *Logger) Fatal(msg string, fields Fields) {
	l.log(FATAL, msg, fields)
	os.Exit(1)
}

func (l *Logger) Fatalf(format string, args ...interface{}) {
	l.log(FATAL, fmt.Sprintf(format, args...), nil)
	os.Exit(1)
}

type traceLogger struct {
	*Logger
	traceID string
	spanID  string
}

func (l *Logger) WithTrace(traceID, spanID string) *traceLogger {
	return &traceLogger{
		Logger:  l,
		traceID: traceID,
		spanID:  spanID,
	}
}

func (tl *traceLogger) withTraceFields(fields Fields) Fields {
	if fields == nil {
		fields = Fields{}
	}
	if tl.traceID != "" {
		fields["trace_id"] = tl.traceID
	}
	if tl.spanID != "" {
		fields["span_id"] = tl.spanID
	}
	return fields
}

func (tl *traceLogger) Debug(msg string, fields Fields) {
	tl.Logger.log(DEBUG, msg, tl.withTraceFields(fields))
}

func (tl *traceLogger) Info(msg string, fields Fields) {
	tl.Logger.log(INFO, msg, tl.withTraceFields(fields))
}

func (tl *traceLogger) Warn(msg string, fields Fields) {
	tl.Logger.log(WARN, msg, tl.withTraceFields(fields))
}

func (tl *traceLogger) Error(msg string, fields Fields) {
	tl.Logger.log(ERROR, msg, tl.withTraceFields(fields))
}

func (tl *traceLogger) Fatal(msg string, fields Fields) {
	tl.Logger.log(FATAL, msg, tl.withTraceFields(fields))
	os.Exit(1)
}

func (tl *traceLogger) Debugf(format string, args ...interface{}) {
	tl.Debug(fmt.Sprintf(format, args...), nil)
}

func (tl *traceLogger) Infof(format string, args ...interface{}) {
	tl.Info(fmt.Sprintf(format, args...), nil)
}

func (tl *traceLogger) Warnf(format string, args ...interface{}) {
	tl.Warn(fmt.Sprintf(format, args...), nil)
}

func (tl *traceLogger) Errorf(format string, args ...interface{}) {
	tl.Error(fmt.Sprintf(format, args...), nil)
}

func (tl *traceLogger) Fatalf(format string, args ...interface{}) {
	tl.Fatal(fmt.Sprintf(format, args...), nil)
}
