# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM golang:1.23-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /build

# Copy go mod files first for better layer caching
COPY go.mod go.sum* ./

# Download dependencies
RUN if [ -f go.sum ]; then go mod download; fi

# Copy source code
COPY . .

# Build the application with optimizations
ENV CGO_ENABLED=0
ENV GOOS=linux
ENV GOARCH=amd64
ENV GOPROXY=https://proxy.golang.org,direct

RUN go build \
    -ldflags="-w -s" \
    -trimpath \
    -o payment-service \
    ./apps/payment-service

# =============================================================================
# Stage 2: Final (scratch image)
# =============================================================================
FROM scratch AS final

# Set GOMAXPROCS for CPU optimization
ENV GOMAXPROCS=2

# Copy CA certificates for HTTPS
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy timezone data for time zone handling
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

# Copy the binary from builder stage
COPY --from=builder /build/payment-service /payment-service

# Create non-root user for security
RUN addgroup -g 1000 appgroup && \
    adduser -u 1000 -G appgroup -s /bin/sh -D appuser

USER appuser

# Expose the application port
EXPOSE 8092

# Health check using wget (available in busybox)
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD wget --quiet --tries=1 --spider http://localhost:8092/healthz || exit 1

# Run the application
ENTRYPOINT ["/payment-service"]
