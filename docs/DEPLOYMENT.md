# Deployment Guide — be-flight-booking (Go Microservices)

## Table of Contents

1. [Overview](#overview)
2. [Repository Structure](#repository-structure)
3. [Environment Variables](#environment-variables)
4. [Local Development](#local-development)
5. [Production Deployment on VPS](#production-deployment-on-vps)
6. [Docker Production Setup](#docker-production-setup)
7. [Cloudflare Tunnel](#cloudflare-tunnel)
8. [Prometheus & Grafana](#prometheus--grafana)
9. [CI/CD with Jenkins](#cicd-with-jenkins)
10. [Terraform & Ansible](#terraform--ansible)
11. [Health Checks & Monitoring](#health-checks--monitoring)
12. [Troubleshooting](#troubleshooting)

---

## Overview

The backend consists of **4 Go microservices** containerized with Docker, communicating via HTTP/gRPC:

| Service | Port | Description |
|---------|------|-------------|
| `api-gateway` | 8080 (HTTP), 50051 (gRPC) | Entry point, auth, routing |
| `search-service` | 8090 | Flight search |
| `booking-service` | 8091 | Booking management |
| `payment-service` | 8092 | Payment processing |

Infrastructure services: **PostgreSQL 16**, **Redis 7**, **RabbitMQ 3.13**.

---

## Repository Structure

```
be-flight-booking/
├── apps/
│   ├── api-gateway/         # API Gateway (Go)
│   ├── search-service/      # Flight search (Go)
│   ├── booking-service/     # Booking management (Go)
│   └── payment-service/     # Payment processing (Go)
├── pkg/                     # Shared libraries
├── scripts/
│   └── db-migrate/          # Database migrations (SQL)
├── docs/
├── docker-compose.yml       # Main compose (dev + prod base)
├── docker-compose.prod.yml  # Production overrides
├── .env.example             # All env vars template
└── Dockerfile               # Multi-stage build (all services)
```

---

## Environment Variables

### `.env.development` — Local Development

```bash
# =============================================================================
# DEVELOPMENT — Local native development (no Docker)
# Copy to: .env (cp .env.example .env)
# =============================================================================

APP_ENV=development
APP_NAME=flight-booking
VERSION=1.0.0

# ─── Services ────────────────────────────────────────────────────────────────
API_GATEWAY_PORT=8080
SEARCH_SERVICE_PORT=8090
BOOKING_SERVICE_PORT=8091
PAYMENT_SERVICE_PORT=8092
GRPC_PORT=50051

# ─── PostgreSQL (local native install) ───────────────────────────────────────
DB_HOST=localhost
DB_PORT=5432
DB_NAME=flightbooking
DB_USER=flightbooking
DB_PASSWORD=flightbooking123
DB_SSLMODE=disable
DB_MAX_CONNECTIONS=25
DB_IDLE_CONNECTIONS=5
DB_CONNECTION_LIFETIME=300

# ─── Redis ────────────────────────────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_FLIGHT_CACHE_TTL=900
REDIS_SESSION_TTL=3600

# ─── RabbitMQ ─────────────────────────────────────────────────────────────────
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_VHOST=/
RABBITMQ_EXCHANGE=flightbooking.events
RABBITMQ_PREFETCH=10

# ─── Aviationstack API (https://aviationstack.com) ───────────────────────────
AVIATIONSTACK_API_KEY=your_dev_api_key_here
AVIATIONSTACK_BASE_URL=https://api.aviationstack.com/v1
AVIATIONSTACK_TIMEOUT=10
AVIATIONSTACK_RETRY_ATTEMPTS=3
AVIATIONSTACK_CACHE_TTL=900

# ─── Payment ──────────────────────────────────────────────────────────────────
PAYMENT_PROVIDER=mock
PAYMENT_MOCK_ENABLED=true

# ─── JWT ──────────────────────────────────────────────────────────────────────
# WARNING: Use weak secret for local dev only
JWT_SECRET=dev_secret_change_before_production
JWT_EXPIRY_HOURS=24

# ─── CORS ─────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
CORS_ALLOWED_METHODS=GET,POST,PUT,PATCH,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Authorization,Content-Type,X-Requested-With,X-Request-ID
CORS_EXPOSE_HEADERS=X-Total-Count,X-Request-ID
CORS_MAX_AGE=86400

# ─── Rate Limit ───────────────────────────────────────────────────────────────
RATE_LIMIT_REQUESTS_PER_MINUTE=100
RATE_LIMIT_BURST=20

# ─── Logging ──────────────────────────────────────────────────────────────────
LOG_LEVEL=debug
LOG_FORMAT=json
```

### `.env.staging` — Staging / UAT Environment

```bash
# =============================================================================
# STAGING — Staging server deployment
# Copy to: .env on staging VPS
# =============================================================================

APP_ENV=staging
APP_NAME=flight-booking
VERSION=1.0.0

# ─── Services ────────────────────────────────────────────────────────────────
API_GATEWAY_PORT=8080
SEARCH_SERVICE_PORT=8090
BOOKING_SERVICE_PORT=8091
PAYMENT_SERVICE_PORT=8092
GRPC_PORT=50051

# ─── PostgreSQL ───────────────────────────────────────────────────────────────
# Use Docker service name — same network
DB_HOST=postgres
DB_PORT=5432
DB_NAME=flightbooking
DB_USER=flightbooking
DB_PASSWORD=staging_password_change_me_very_long_and_random
DB_SSLMODE=disable
DB_MAX_CONNECTIONS=50
DB_IDLE_CONNECTIONS=10
DB_CONNECTION_LIFETIME=300

# ─── Redis ────────────────────────────────────────────────────────────────────
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_FLIGHT_CACHE_TTL=600
REDIS_SESSION_TTL=1800

# ─── RabbitMQ ─────────────────────────────────────────────────────────────────
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=staging_admin
RABBITMQ_PASSWORD=staging_rabbitmq_change_me_very_long
RABBITMQ_VHOST=/
RABBITMQ_EXCHANGE=flightbooking.events
RABBITMQ_PREFETCH=10

# ─── Aviationstack API ────────────────────────────────────────────────────────
AVIATIONSTACK_API_KEY=staging_api_key_here
AVIATIONSTACK_BASE_URL=https://api.aviationstack.com/v1
AVIATIONSTACK_TIMEOUT=10
AVIATIONSTACK_RETRY_ATTEMPTS=3
AVIATIONSTACK_CACHE_TTL=600

# ─── Payment ──────────────────────────────────────────────────────────────────
PAYMENT_PROVIDER=mock
PAYMENT_MOCK_ENABLED=true

# ─── JWT ──────────────────────────────────────────────────────────────────────
JWT_SECRET=staging_jwt_secret_generate_with_openssl_rand_base64_32
JWT_EXPIRY_HOURS=24

# ─── CORS ─────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS=http://staging.yourdomain.com,http://staging.yourdomain.com:3001
CORS_ALLOWED_METHODS=GET,POST,PUT,PATCH,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Authorization,Content-Type,X-Requested-With,X-Request-ID
CORS_EXPOSE_HEADERS=X-Total-Count,X-Request-ID
CORS_MAX_AGE=86400

# ─── Rate Limit ───────────────────────────────────────────────────────────────
RATE_LIMIT_REQUESTS_PER_MINUTE=100
RATE_LIMIT_BURST=20

# ─── Logging ──────────────────────────────────────────────────────────────────
LOG_LEVEL=info
LOG_FORMAT=json
```

### `.env.production` — Production Environment

```bash
# =============================================================================
# PRODUCTION — Live production server
# Copy to: .env on production VPS
# CRITICAL: Use strong random values for all secrets
# =============================================================================

APP_ENV=production
APP_NAME=flight-booking
VERSION=1.0.0

# ─── Services ────────────────────────────────────────────────────────────────
API_GATEWAY_PORT=8080
SEARCH_SERVICE_PORT=8090
BOOKING_SERVICE_PORT=8091
PAYMENT_SERVICE_PORT=8092
GRPC_PORT=50051

# ─── PostgreSQL ───────────────────────────────────────────────────────────────
DB_HOST=postgres
DB_PORT=5432
DB_NAME=flightbooking
DB_USER=flightbooking
DB_PASSWORD=$(openssl rand -base64 32)   # Generate: openssl rand -base64 48
DB_SSLMODE=disable
DB_MAX_CONNECTIONS=100
DB_IDLE_CONNECTIONS=20
DB_CONNECTION_LIFETIME=300

# ─── Redis ────────────────────────────────────────────────────────────────────
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=$(openssl rand -base64 32)
REDIS_DB=0
REDIS_FLIGHT_CACHE_TTL=300
REDIS_SESSION_TTL=900

# ─── RabbitMQ ─────────────────────────────────────────────────────────────────
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=prod_admin
RABBITMQ_PASSWORD=$(openssl rand -base64 32)
RABBITMQ_VHOST=/
RABBITMQ_EXCHANGE=flightbooking.events
RABBITMQ_PREFETCH=10

# ─── Aviationstack API ────────────────────────────────────────────────────────
AVIATIONSTACK_API_KEY=your_real_production_api_key
AVIATIONSTACK_BASE_URL=https://api.aviationstack.com/v1
AVIATIONSTACK_TIMEOUT=15
AVIATIONSTACK_RETRY_ATTEMPTS=5
AVIATIONSTACK_CACHE_TTL=300

# ─── Payment ──────────────────────────────────────────────────────────────────
PAYMENT_PROVIDER=stripe   # or: paypal, mock
PAYMENT_MOCK_ENABLED=false

# ─── JWT ──────────────────────────────────────────────────────────────────────
# Generate with: openssl rand -base64 64
JWT_SECRET=YOUR_VERY_LONG_RANDOM_SECRET_AT_LEAST_64_CHARS_HERE
JWT_EXPIRY_HOURS=1

# ─── CORS ─────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CORS_ALLOWED_METHODS=GET,POST,PUT,PATCH,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Authorization,Content-Type,X-Requested-With,X-Request-ID
CORS_EXPOSE_HEADERS=X-Total-Count,X-Request-ID
CORS_MAX_AGE=86400

# ─── Rate Limit ───────────────────────────────────────────────────────────────
RATE_LIMIT_REQUESTS_PER_MINUTE=60
RATE_LIMIT_BURST=10

# ─── Logging ──────────────────────────────────────────────────────────────────
LOG_LEVEL=warn
LOG_FORMAT=json
```

### Quick Reference: `.env.development` vs `.env.staging` vs `.env.production`

| Variable | Development | Staging | Production |
|----------|-------------|---------|------------|
| `APP_ENV` | `development` | `staging` | `production` |
| `DB_HOST` | `localhost` | `postgres` | `postgres` |
| `REDIS_HOST` | `localhost` | `redis` | `redis` |
| `RABBITMQ_HOST` | `localhost` | `rabbitmq` | `rabbitmq` |
| `PAYMENT_MOCK_ENABLED` | `true` | `true` | `false` |
| `PAYMENT_PROVIDER` | `mock` | `mock` | `stripe` |
| `JWT_SECRET` | Weak dev secret | Medium strength | Strong random (64+ chars) |
| `CORS_ALLOWED_ORIGINS` | `localhost:*` | Staging domain | Production domain (HTTPS) |
| `LOG_LEVEL` | `debug` | `info` | `warn` |
| `DB_MAX_CONNECTIONS` | 25 | 50 | 100 |
| `AVIATIONSTACK_CACHE_TTL` | 900 | 600 | 300 |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | 100 | 100 | 60 |
| `RABBITMQ_USER/PASS` | `guest/guest` | Custom staging creds | Strong random |

---

## Local Development

### Prerequisites

- Go 1.23+
- Docker & Docker Compose
- PostgreSQL (or use Docker)
- Redis (or use Docker)
- RabbitMQ (or use Docker)

### Using Docker (Recommended)

```bash
# 1. Copy env file
cp .env.example .env

# 2. Start all services (BE + infrastructure)
docker compose up -d

# 3. Check health
curl http://localhost:8080/healthz

# 4. View logs
docker compose logs -f api-gateway

# 5. Stop
docker compose down
```

### Using Docker (Infrastructure Only)

```bash
# Start only infrastructure (PG, Redis, RabbitMQ)
docker compose -f docker-compose.infrastructure.yml up -d

# Then run services natively
cd apps/api-gateway && go run .
```

---

## Production Deployment on VPS

This guide covers deploying on a fresh VPS (Ubuntu 22.04/24.04) from scratch.

### Step 1: Initial VPS Setup

```bash
# Connect to your VPS
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y

# Install prerequisites
apt install -y curl git unzip ufw fail2ban

# Create deploy user
useradd -m -s /bin/bash deploy
usermod -aG docker deploy
su - deploy

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker

# Install Docker Compose plugin
apt install -y docker-compose-plugin
```

### Step 2: Clone Repositories

```bash
# As deploy user on VPS
cd ~
mkdir -p ~/flight-booking
cd ~/flight-booking

# Clone BE
git clone https://github.com/YOUR_USERNAME/be-flight-booking.git ./be
# Clone FE
git clone https://github.com/YOUR_USERNAME/fe-flight-booking.git ./fe

# Directory structure
# ~/flight-booking/
#   ├── be/
#   │   ├── apps/
#   │   ├── docker-compose.yml
#   │   └── .env           ← create this from .env.production template
#   └── fe/
#       ├── src/
#       ├── Dockerfile
#       └── .env            ← create this from .env.production template
```

### Step 3: Configure Environment

```bash
# ─── BE: Create .env for production ─────────────────────────────────────────
cd ~/flight-booking/be

# Generate strong secrets
export JWT_SECRET=$(openssl rand -base64 64)
export DB_PASSWORD=$(openssl rand -base64 48)
export REDIS_PASSWORD=$(openssl rand -base64 32)
export RABBITMQ_PASSWORD=$(openssl rand -base64 32)

# Create .env file
cat > .env << 'EOF'
APP_ENV=production
APP_NAME=flight-booking
VERSION=1.0.0

API_GATEWAY_PORT=8080
SEARCH_SERVICE_PORT=8090
BOOKING_SERVICE_PORT=8091
PAYMENT_SERVICE_PORT=8092
GRPC_PORT=50051

DB_HOST=postgres
DB_PORT=5432
DB_NAME=flightbooking
DB_USER=flightbooking
DB_PASSWORD=REPLACE_WITH_YOUR_DB_PASSWORD
DB_SSLMODE=disable
DB_MAX_CONNECTIONS=100
DB_IDLE_CONNECTIONS=20
DB_CONNECTION_LIFETIME=300

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=REPLACE_WITH_YOUR_REDIS_PASSWORD
REDIS_DB=0
REDIS_FLIGHT_CACHE_TTL=300
REDIS_SESSION_TTL=900

RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=prod_admin
RABBITMQ_PASSWORD=REPLACE_WITH_YOUR_RABBITMQ_PASSWORD
RABBITMQ_VHOST=/
RABBITMQ_EXCHANGE=flightbooking.events
RABBITMQ_PREFETCH=10

AVIATIONSTACK_API_KEY=your_production_api_key
AVIATIONSTACK_BASE_URL=https://api.aviationstack.com/v1
AVIATIONSTACK_TIMEOUT=15
AVIATIONSTACK_RETRY_ATTEMPTS=5
AVIATIONSTACK_CACHE_TTL=300

PAYMENT_PROVIDER=stripe
PAYMENT_MOCK_ENABLED=false

JWT_SECRET=REPLACE_WITH_YOUR_JWT_SECRET_64_CHARS
JWT_EXPIRY_HOURS=1

CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CORS_ALLOWED_METHODS=GET,POST,PUT,PATCH,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Authorization,Content-Type,X-Requested-With,X-Request-ID
CORS_EXPOSE_HEADERS=X-Total-Count,X-Request-ID
CORS_MAX_AGE=86400

RATE_LIMIT_REQUESTS_PER_MINUTE=60
RATE_LIMIT_BURST=10

LOG_LEVEL=warn
LOG_FORMAT=json
EOF

chmod 600 .env
```

### Step 4: Deploy with Docker Compose

```bash
cd ~/flight-booking/be

# Pull latest images (if using registry) or build locally
# Build all service images
docker compose build --build-arg VERSION=$(date +%Y%m%d%H%M%S)

# Start services
docker compose up -d

# Check status
docker compose ps

# Check health
curl http://localhost:8080/healthz
curl http://localhost:8090/healthz
curl http://localhost:8091/healthz
curl http://localhost:8092/healthz

# View logs
docker compose logs -f

# Restart specific service
docker compose restart api-gateway

# Full restart
docker compose down && docker compose up -d
```

### Step 5: Database Migration

```bash
cd ~/flight-booking/be

# Run migrations (SQL files in scripts/db-migrate/)
# Connect to postgres container
docker compose exec postgres psql -U flightbooking -d flightbooking

# Or run migrations manually
docker compose exec -T postgres psql -U flightbooking -d flightbooking < scripts/db-migrate/001_initial_schema.sql
```

---

## Docker Production Setup

### `docker-compose.prod.yml` — Production Overrides

```yaml
# =============================================================================
# Production overrides for docker-compose.yml
# Usage: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
# =============================================================================

services:
  api-gateway:
    restart: always
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M

  search-service:
    restart: always
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1.0'
          memory: 512M

  booking-service:
    restart: always
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.5'
          memory: 256M

  payment-service:
    restart: always
    deploy:
      replicas: 1
      resources:
        limits:
          cpus: '0.5'
          memory: 256M

  postgres:
    restart: always
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/db-migrate:/migrations:ro
      - ./backups:/backups:ro
    command: >
      postgres
      -c max_connections=100
      -c shared_buffers=512MB
      -c effective_cache_size=1GB
      -c maintenance_work_mem=128MB
      -c checkpoint_completion_target=0.9
      -c wal_buffers=16MB
      -c default_statistics_target=100

  redis:
    restart: always
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
    command: >
      redis-server
      --maxmemory 384mb
      --maxmemory-policy allkeys-lru
      --save 900 1
      --save 300 10
      --appendonly yes
      --appendfsync everysec

  rabbitmq:
    restart: always
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G

# Disable external ports in production (use reverse proxy instead)
networks:
  default:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

### Deploy with Production Overrides

```bash
# Build + start with prod overrides
cd ~/flight-booking/be
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --build-arg VERSION=$(git rev-parse --short HEAD)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Scale specific service
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale search-service=3

# Update without downtime
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps
```

---

## Cloudflare Tunnel

Use Cloudflare Tunnel (formerly Argo Tunnel) to expose your VPS services without opening firewall ports.

### Step 1: Install cloudflared

```bash
# On VPS
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Verify
cloudflared --version
```

### Step 2: Create Cloudflare Tunnel

```bash
# Login to Cloudflare dashboard → Zero Trust → Networks → Tunnels
# Or use command line:
cloudflared tunnel login
cloudflared tunnel create flight-booking-staging
cloudflared tunnel list
```

### Step 3: Configure Tunnel

```bash
# On VPS
cat > /etc/cloudflared/config.yml << 'EOF'
# Tunnel credentials
tunnel: YOUR_TUNNEL_ID
credentials-file: /etc/cloudflared/credentials.json

# Ingress rules — map domain to service
ingress:
  # API Gateway
  - hostname: api-staging.yourdomain.com
    service: http://localhost:8080
    originRequest:
      noTLSVerify: false

  # RabbitMQ Management UI
  - hostname: rabbitmq-staging.yourdomain.com
    service: http://localhost:15672

  # Health check
  - hostname: health-staging.yourdomain.com
    service: http://localhost:8080/healthz

  # Default
  - service: http_status:404
EOF

chmod 600 /etc/cloudflared/config.yml
```

### Step 4: Run as Systemd Service

```bash
# Create systemd service
cat > /etc/systemd/system/cloudflared.service << 'EOF'
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/cloudflared tunnel run --config /etc/cloudflared/config.yml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl enable cloudflared
systemctl start cloudflared
systemctl status cloudflared

# Check logs
journalctl -u cloudflared -f
```

### Step 5: DNS Routing (Cloudflare Dashboard)

In Cloudflare dashboard → DNS:
- `api-staging.yourdomain.com` → CNAME → `YOUR_TUNNEL_ID.cfargotunnel.com`
- `rabbitmq-staging.yourdomain.com` → CNAME → `YOUR_TUNNEL_ID.cfargotunnel.com`
- `health-staging.yourdomain.com` → CNAME → `YOUR_TUNNEL_ID.cfargotunnel.com`

### Production Cloudflare Tunnel

For production, use Cloudflare Access policies and always-enforce HTTPS:

```bash
cat > /etc/cloudflared/config.prod.yml << 'EOF'
tunnel: YOUR_PROD_TUNNEL_ID
credentials-file: /etc/cloudflared/credentials-prod.json

ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:8080
    originRequest:
      noTLSVerify: false
      connectTimeout: 30s
      tlsTimeout: 10s
  - hostname: api.yourdomain.com
    service: http://localhost:8080
    path: healthz
  - service: http_status:404
EOF
```

---

## Prometheus & Grafana

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Services   │────▶│  Prometheus  │────▶│   Grafana  │
│ (metrics)   │     │  (scrape)    │     │ (dashboard)│
└─────────────┘     └──────────────┘     └─────────────┘
                         │
                    ┌────▼────┐
                    │ AlertMgr│
                    └─────────┘
```

### Step 1: Add Prometheus Configuration

Create `monitoring/prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: []

rule_files: []

scrape_configs:
  # API Gateway
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['api-gateway:8080']
    metrics_path: /metrics
    scrape_interval: 10s

  # Search Service
  - job_name: 'search-service'
    static_configs:
      - targets: ['search-service:8090']
    metrics_path: /metrics
    scrape_interval: 10s

  # Booking Service
  - job_name: 'booking-service'
    static_configs:
      - targets: ['booking-service:8091']
    metrics_path: /metrics
    scrape_interval: 10s

  # Payment Service
  - job_name: 'payment-service'
    static_configs:
      - targets: ['payment-service:8092']
    metrics_path: /metrics
    scrape_interval: 10s

  # PostgreSQL Exporter
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  # RabbitMQ Exporter
  - job_name: 'rabbitmq'
    static_configs:
      - targets: ['rabbitmq-exporter:9419']

  # Redis Exporter
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
```

### Step 2: Create Monitoring Compose

Create `monitoring/docker-compose.monitoring.yml`:

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:v2.50.0
    container_name: fb-prometheus
    restart: unless-stopped
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=15d'
      - '--storage.tsdb.retention.size=10GB'
      - '--web.enable-lifecycle'
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - flight-booking-net
    labels:
      app: prometheus

  grafana:
    image: grafana/grafana:10.4.0
    container_name: fb-grafana
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: CHANGE_ME_IN_PRODUCTION
      GF_USERS_ALLOW_SIGN_UP: "false"
      GF_SERVER_ROOT_URL: https://grafana.yourdomain.com
      GF_SERVER_DOMAIN: grafana.yourdomain.com
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
    ports:
      - "3002:3000"
    networks:
      - flight-booking-net
    depends_on:
      - prometheus
    labels:
      app: grafana

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:v0.15.0
    container_name: fb-postgres-exporter
    restart: unless-stopped
    environment:
      DATA_SOURCE_NAME: postgresql://flightbooking:PASSWORD@postgres:5432/flightbooking?sslmode=disable
    ports:
      - "9187:9187"
    networks:
      - flight-booking-net
    depends_on:
      - postgres

  rabbitmq-exporter:
    image: kbudde/rabbitmq-exporter:latest
    container_name: fb-rabbitmq-exporter
    restart: unless-stopped
    environment:
      RABBIT_URL: http://rabbitmq:15672
      RABBIT_USER: ${RABBITMQ_USER:-prod_admin}
      RABBIT_PASSWORD: ${RABBITMQ_PASSWORD:-password}
      PUBLISH_PORT: "9419"
    ports:
      - "9419:9419"
    networks:
      - flight-booking-net
    depends_on:
      - rabbitmq

  redis-exporter:
    image: oliver006/redis_exporter:v1.60.0
    container_name: fb-redis-exporter
    restart: unless-stopped
    environment:
      REDIS_ADDR: redis://redis:6379
      REDIS_PASSWORD: ${REDIS_PASSWORD:-}
    ports:
      - "9121:9121"
    networks:
      - flight-booking-net
    depends_on:
      - redis

  alertmanager:
    image: prom/alertmanager:v0.27.0
    container_name: fb-alertmanager
    restart: unless-stopped
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
    volumes:
      - ./alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
      - alertmanager_data:/alertmanager
    ports:
      - "9093:9093"
    networks:
      - flight-booking-net

volumes:
  prometheus_data:
  grafana_data:
  alertmanager_data:

networks:
  flight-booking-net:
    external: true
```

### Step 3: Grafana Provisioning

Create `monitoring/grafana/provisioning/dashboards/dashboards.yml`:

```yaml
apiVersion: 1
providers:
  - name: 'Flight Booking'
    orgId: 1
    folder: 'Flight Booking'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    options:
      path: /etc/grafana/provisioning/dashboards
```

Create `monitoring/grafana/provisioning/datasources/datasources.yml`:

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

### Step 4: Start Monitoring Stack

```bash
# Create external network (must match docker-compose.yml)
docker network create flight-booking-net

# Start monitoring
cd ~/flight-booking/monitoring
docker compose -f docker-compose.monitoring.yml up -d

# Access Grafana: http://your-vps-ip:3002
# Default credentials: admin / CHANGE_ME_IN_PRODUCTION

# Access Prometheus: http://your-vps-ip:9090
```

### Step 5: Add Go Metrics Endpoint (if not already implemented)

Add Prometheus metrics to each Go service using `prometheus/client_golang`:

```go
// In each service's main.go
import (
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
    // ... existing code ...

    // Expose /metrics endpoint
    http.Handle("/metrics", promhttp.Handler())

    http.ListenAndServe(":8080", nil)
}
```

### Recommended Grafana Dashboards

Import these dashboard IDs from Grafana:
- **Go services**: ID `6673` (Go runtime metrics)
- **PostgreSQL**: ID `9628` (PostgreSQL Overview)
- **Redis**: ID `11835` (Redis Dashboard)
- **RabbitMQ**: ID `10991` (RabbitMQ Overview)

---

## CI/CD with Jenkins

### Jenkins Architecture

```
GitHub Webhook
      │
      ▼
┌─────────────┐
│   Jenkins   │───▶ Build Stage (Test, Lint, Build Docker)
│   Master    │
└─────────────┘
      │
      ├──▶ Staging Deploy ──▶ Cloudflare Tunnel ──▶ api-staging.yourdomain.com
      │
      └──▶ Production Deploy ──▶ Cloudflare Tunnel ──▶ api.yourdomain.com
```

### Step 1: Install Jenkins on VPS

```bash
# Install Java (required for Jenkins)
apt install -y openjdk-17-jdk

# Add Jenkins repository
curl -fsSL https://pkg.jenkins.io/debian/jenkins.io-2023.key | gpg --dearmor -o /usr/share/keyrings/jenkins.gpg
echo "deb [signed-by=/usr/share/keyrings/jenkins.gpg] https://pkg.jenkins.io/debian binary/" | tee /etc/apt/sources.list.d/jenkins.list > /dev/null

apt update
apt install -y jenkins

# Start Jenkins
systemctl enable jenkins
systemctl start jenkins

# Get initial admin password
cat /var/lib/jenkins/secrets/initialAdminPassword
```

Access Jenkins at `http://your-vps-ip:8080` and complete the setup wizard.

### Step 2: Install Required Jenkins Plugins

Go to **Manage Jenkins → Plugin Manager** and install:
- `docker-plugin`
- `credentials-binding-plugin`
- `ssh-agent-plugin`
- `ghprb` (GitHub Pull Request Builder) or `github-branch-source`
- `prometheus metrics`

### Step 3: Create Jenkins Pipeline (Jenkinsfile)

Create `Jenkinsfile` in `be-flight-booking/` root:

```groovy
pipeline {
    agent any

    environment {
        DOCKER_REGISTRY = 'your-registry.com'
        DOCKER_IMAGE = 'flight-booking'
        APP_NAME = 'flight-booking-be'
        DEPLOY_STAGING = 'deploy@staging-server'
        DEPLOY_PROD = 'deploy@prod-server'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                    env.VERSION = env.GIT_COMMIT_SHORT
                }
            }
        }

        stage('Test') {
            steps {
                dir('pkg') {
                    sh 'go mod download'
                    sh 'go test ./... -v -count=1'
                }
                script {
                    def services = ['api-gateway', 'search-service', 'booking-service', 'payment-service']
                    for (svc in services) {
                        dir("apps/${svc}") {
                            sh 'go mod download'
                            sh 'go test ./... -v -count=1'
                        }
                    }
                }
            }
        }

        stage('Lint') {
            steps {
                dir('pkg') {
                    sh 'go vet ./...'
                }
                script {
                    def services = ['api-gateway', 'search-service', 'booking-service', 'payment-service']
                    for (svc in services) {
                        dir("apps/${svc}") {
                            sh 'go vet ./...'
                        }
                    }
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                script {
                    def services = ['api-gateway', 'search-service', 'booking-service', 'payment-service']
                    for (svc in services) {
                        def imageName = "${env.DOCKER_REGISTRY}/${env.DOCKER_IMAGE}/${svc}:${env.VERSION}"
                        sh """
                            docker build \
                                --build-arg VERSION=${env.VERSION} \
                                --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
                                --build-arg COMMIT_SHA=${env.GIT_COMMIT_SHORT} \
                                -t ${imageName} \
                                -f apps/${svc}/Dockerfile \
                                apps/${svc}
                        """
                        sh "docker tag ${imageName} ${env.DOCKER_REGISTRY}/${env.DOCKER_IMAGE}/${svc}:latest"
                        sh "docker push ${imageName}"
                        sh "docker push ${env.DOCKER_REGISTRY}/${env.DOCKER_IMAGE}/${svc}:latest"
                    }
                }
            }
        }

        stage('Deploy to Staging') {
            when {
                branch 'develop'
            }
            steps {
                sshagent(credentials: ['staging-ssh-key']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no deploy@staging-server '
                            cd ~/flight-booking/be && \\
                            echo "VERSION='${env.VERSION}'" >> .env && \\
                            docker compose -f docker-compose.yml -f docker-compose.prod.yml pull && \\
                            docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
                        '
                    '''
                }
            }
        }

        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                sshagent(credentials: ['prod-ssh-key']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no deploy@prod-server '
                            cd ~/flight-booking/be && \\
                            docker compose -f docker-compose.yml -f docker-compose.prod.yml pull && \\
                            docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
                        '
                    '''
                }
                input message: 'Deploy to production?', ok: 'Deploy'
            }
        }
    }

    post {
        always {
            script {
                def status = currentBuild.result ?: 'SUCCESS'
                if (status == 'FAILURE') {
                    echo "Build failed - check logs"
                }
            }
        }
        success {
            echo "Pipeline completed successfully!"
        }
        failure {
            echo "Pipeline failed!"
        }
    }
}
```

### Step 4: Jenkins Credentials

Add credentials in **Manage Jenkins → Credentials**:

| ID | Type | Description |
|----|------|-------------|
| `staging-ssh-key` | SSH Username with private key | Staging deploy user |
| `prod-ssh-key` | SSH Username with private key | Production deploy user |
| `docker-registry` | Username/Password | Registry credentials |

### Step 5: Create Multibranch Pipeline

1. **New Item → Multibranch Pipeline**
2. Branch Sources → Add source → GitHub
3. Credentials: Add GitHub token
4. Filter by name (regex): `^(main|develop|feature/.*|hotfix/.*)$`
5. Build Configuration → by `Jenkinsfile`
6. Scan Triggers → Periodically if not otherwise run (interval: 5 min)

---

## Terraform & Ansible

### Infrastructure Overview (Terraform)

```
VPS Provider (Hetzner/DigitalOcean/Vultr)
│
├── Main VPS (Ubuntu 22.04)
│   ├── Docker Engine
│   ├── Docker Compose
│   ├── Cloudflared (Tunnel)
│   └── Monitoring Stack
│
└── Backup VPS (optional)
    └── Automated backups
```

### Terraform Configuration

Create `infrastructure/terraform/main.tf`:

```hcl
terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
  required_version = ">= 1.5.0"
}

provider "digitalocean" {
  token = var.do_token
}

# ─── SSH Key ─────────────────────────────────────────────────────────────────
resource "digitalocean_ssh_key" "deploy_key" {
  name       = "flight-booking-deploy"
  public_key = file("~/.ssh/id_rsa.pub")
}

# ─── Firewall ────────────────────────────────────────────────────────────────
resource "digitalocean_firewall" "flight_booking" {
  name = "flight-booking-firewall"

  # Only allow Cloudflare IPs (get from https://www.cloudflare.com/ips/)
  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22",
                         "103.31.4.0/22", "141.101.64.0/18", "108.162.192.0/18",
                         "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22",
                         "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
                         "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22"]
  }

  # Allow SSH from specific IP only
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["YOUR_HOME_IP/32"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "443"
    destination_addresses = ["0.0.0.0/0"]
  }

  inbound_rule {
    protocol         = "icmp"
    source_addresses = ["0.0.0.0/0"]
  }
}

# ─── Staging Droplet ──────────────────────────────────────────────────────────
resource "digitalocean_droplet" "staging" {
  name     = "flight-booking-staging"
  size     = "s-2vcpu-4gb"     # 2 vCPU, 4GB RAM
  image    = "ubuntu-22-04-x64"
  region   = "sgp1"             # Singapore
  ssh_keys = [digitalocean_ssh_key.deploy_key.id]

  connection {
    host        = self.ipv4_address
    user        = "root"
    private_key = file("~/.ssh/id_rsa")
    timeout     = "2m"
  }

  provisioner "remote-exec" {
    inline = [
      "apt update && apt upgrade -y",
      "apt install -y curl git unzip ufw fail2ban",
      "curl -fsSL https://get.docker.com | sh",
      "usermod -aG docker root",
      "apt install -y docker-compose-plugin",
      "ufw allow ssh",
      "ufw allow 443",
      "ufw --force enable"
    ]
  }
}

# ─── Production Droplet ──────────────────────────────────────────────────────
resource "digitalocean_droplet" "production" {
  name     = "flight-booking-production"
  size     = "s-4vcpu-8gb"     # 4 vCPU, 8GB RAM
  image    = "ubuntu-22-04-x64"
  region   = "sgp1"
  ssh_keys = [digitalocean_ssh_key.deploy_key.id]

  connection {
    host        = self.ipv4_address
    user        = "root"
    private_key = file("~/.ssh/id_rsa")
    timeout     = "2m"
  }

  provisioner "remote-exec" {
    inline = [
      "apt update && apt upgrade -y",
      "apt install -y curl git unzip ufw fail2ban",
      "curl -fsSL https://get.docker.com | sh",
      "usermod -aG docker root",
      "apt install -y docker-compose-plugin",
      "ufw allow ssh",
      "ufw allow 443",
      "ufw --force enable"
    ]
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ─── Floating IP ──────────────────────────────────────────────────────────────
resource "digitalocean_floating_ip" "prod_static" {
  region = digitalocean_droplet.production.region
}

resource "digitalocean_floating_ip_assignment" "prod_static" {
  ip_address = digitalocean_floating_ip.prod_static.ip_address
  droplet_id = digitalocean_droplet.production.id
}

# ─── DNS Records ──────────────────────────────────────────────────────────────
resource "digitalocean_record" "staging_api" {
  domain = var.domain
  type   = "CNAME"
  name   = "api-staging"
  value  = "${digitalocean_droplet.staging.ipv4_address}"
}

resource "digitalocean_record" "prod_api" {
  domain = var.domain
  type   = "CNAME"
  name   = "api"
  value  = digitalocean_floating_ip.prod_static.ip_address
}

# ─── Outputs ──────────────────────────────────────────────────────────────────
output "staging_ip" {
  value = digitalocean_droplet.staging.ipv4_address
}

output "production_ip" {
  value = digitalocean_floating_ip.prod_static.ip_address
}
```

Create `infrastructure/terraform/variables.tf`:

```hcl
variable "do_token" {
  description = "DigitalOcean API Token"
  type        = string
  sensitive   = true
}

variable "domain" {
  description = "Your domain name"
  type        = string
  default     = "yourdomain.com"
}

variable "staging_size" {
  description = "Staging droplet size"
  type        = string
  default     = "s-2vcpu-4gb"
}

variable "production_size" {
  description = "Production droplet size"
  type        = string
  default     = "s-4vcpu-8gb"
}
```

Create `infrastructure/terraform/terraform.tfvars`:

```hcl
do_token  = "your_digitalocean_token_here"
domain    = "yourdomain.com"
```

### Ansible Configuration

Create `infrastructure/ansible/inventory.ini`:

```ini
[staging]
staging.yourdomain.com ansible_user=deploy

[production]
prod.yourdomain.com ansible_user=deploy

[monitoring]
monitoring.yourdomain.com ansible_user=deploy

[all:vars]
ansible_python_interpreter=/usr/bin/python3
ansible_ssh_private_key_file=~/.ssh/id_rsa
```

Create `infrastructure/ansible/playbooks/deploy-backend.yml`:

```yaml
---
- name: Deploy Flight Booking Backend
  hosts: all
  become: true
  vars:
    app_dir: ~/flight-booking/be
    app_env: production
    image_tag: "{{ lookup('env', 'DEPLOY_VERSION') | default('latest', true) }}"

  tasks:
    - name: Ensure app directory exists
      file:
        path: "{{ app_dir }}"
        state: directory
        owner: deploy
        group: deploy

    - name: Copy deployment files
      synchronize:
        src: ../../be-flight-booking/
        dest: "{{ app_dir }}/"
        delete: yes
        recursive: yes
        rsync_opts:
          - "--exclude=.git"
          - "--exclude=node_modules"
          - "--exclude=vendor"

    - name: Create .env from secrets
      template:
        src: templates/env.j2
        dest: "{{ app_dir }}/.env"
        owner: deploy
        group: deploy
        mode: '0600'
      notify: Restart services

    - name: Build Docker images
      community.docker.docker_compose_v2:
        project_src: "{{ app_dir }}"
        files:
          - docker-compose.yml
          - docker-compose.prod.yml
        pull: yes
      notify: Restart services

    - name: Start services
      community.docker.docker_compose_v2:
        project_src: "{{ app_dir }}"
        files:
          - docker-compose.yml
          - docker-compose.prod.yml
        state: present

    - name: Wait for services to be healthy
      uri:
        url: "http://localhost:8080/healthz"
        status_code: 200
      register: health
      until: health.status == 200
      retries: 30
      delay: 5

    - name: Check all services health
      uri:
        url: "http://localhost:{{ item.port }}/healthz"
        status_code: 200
      loop:
        - { name: api-gateway, port: 8080 }
        - { name: search-service, port: 8090 }
        - { name: booking-service, port: 8091 }
        - { name: payment-service, port: 8092 }

  handlers:
    - name: Restart services
      community.docker.docker_compose_v2:
        project_src: "{{ app_dir }}"
        files:
          - docker-compose.yml
          - docker-compose.prod.yml
        state: restarted
```

Create `infrastructure/ansible/templates/env.j2`:

```bash
# Generated by Ansible — DO NOT COMMIT
APP_ENV={{ app_env }}
APP_NAME=flight-booking
VERSION={{ image_tag }}

API_GATEWAY_PORT=8080
SEARCH_SERVICE_PORT=8090
BOOKING_SERVICE_PORT=8091
PAYMENT_SERVICE_PORT=8092
GRPC_PORT=50051

DB_HOST=postgres
DB_PORT=5432
DB_NAME={{ db_name }}
DB_USER={{ db_user }}
DB_PASSWORD={{ db_password }}
DB_SSLMODE=disable
DB_MAX_CONNECTIONS=100
DB_IDLE_CONNECTIONS=20
DB_CONNECTION_LIFETIME=300

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD={{ redis_password }}
REDIS_DB=0
REDIS_FLIGHT_CACHE_TTL=300
REDIS_SESSION_TTL=900

RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER={{ rabbitmq_user }}
RABBITMQ_PASSWORD={{ rabbitmq_password }}
RABBITMQ_VHOST=/
RABBITMQ_EXCHANGE=flightbooking.events
RABBITMQ_PREFETCH=10

AVIATIONSTACK_API_KEY={{ aviationstack_key }}
AVIATIONSTACK_BASE_URL=https://api.aviationstack.com/v1
AVIATIONSTACK_TIMEOUT=15
AVIATIONSTACK_RETRY_ATTEMPTS=5
AVIATIONSTACK_CACHE_TTL=300

PAYMENT_PROVIDER={{ payment_provider }}
PAYMENT_MOCK_ENABLED={{ payment_mock_enabled }}

JWT_SECRET={{ jwt_secret }}
JWT_EXPIRY_HOURS=1

CORS_ALLOWED_ORIGINS={{ cors_origins }}
CORS_ALLOWED_METHODS=GET,POST,PUT,PATCH,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Authorization,Content-Type,X-Requested-With,X-Request-ID
CORS_EXPOSE_HEADERS=X-Total-Count,X-Request-ID
CORS_MAX_AGE=86400

RATE_LIMIT_REQUESTS_PER_MINUTE=60
RATE_LIMIT_BURST=10

LOG_LEVEL=warn
LOG_FORMAT=json
```

Create `infrastructure/ansible/playbooks/setup-server.yml`:

```yaml
---
- name: Setup Server for Flight Booking
  hosts: all
  become: true
  vars:
    docker_version: "latest"
    cloudflared_version: "2024.1.5"

  tasks:
    - name: Update apt cache
      apt:
        update_cache: yes
        cache_valid_time: 3600

    - name: Install system packages
      apt:
        pkg:
          - curl
          - git
          - unzip
          - ufw
          - fail2ban
          - ca-certificates
          - gnupg
          - lsb-release
        state: present

    - name: Add Docker GPG key
      ansible.builtin.shell:
        cmd: install -m 0755 -d /etc/apt/keyrings && curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && chmod a+r /etc/apt/keyrings/docker.gpg

    - name: Add Docker repository
      ansible.builtin.shell:
        cmd: echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    - name: Install Docker
      apt:
        pkg:
          - docker-ce
          - docker-ce-cli
          - containerd.io
          - docker-buildx-plugin
          - docker-compose-plugin
        state: present

    - name: Create deploy user
      user:
        name: deploy
        shell: /bin/bash
        groups: docker
        append: yes

    - name: Install cloudflared
      ansible.builtin.shell:
        cmd: curl -L https://github.com/cloudflare/cloudflared/releases/download/{{ cloudflared_version }}/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared

    - name: Configure UFW
      community.general.ufw:
        state: enabled
        policy: deny
      notify: Allow SSH

    - name: UFW allow HTTPS
      community.general.ufw:
        rule: allow
        port: '443'
        proto: tcp

    - name: UFW allow HTTP
      community.general.ufw:
        rule: allow
        port: '80'
        proto: tcp

    - name: Enable services
      systemd:
        name: "{{ item }}"
        enabled: yes
      loop:
        - docker
        - fail2ban

  handlers:
    - name: Allow SSH
      community.general.ufw:
        rule: allow
        port: '22'
        proto: tcp
        from_ip: "{{ ansible_host }}/32"
```

### Run Terraform & Ansible

```bash
cd infrastructure/terraform

# Initialize
terraform init

# Plan
terraform plan -var-file="terraform.tfvars"

# Apply
terraform apply -var-file="terraform.tfvars"

# Get IPs
terraform output

# Then provision with Ansible
cd ../ansible

# Run setup playbook
ansible-playbook -i inventory.ini playbooks/setup-server.yml --limit staging

# Deploy backend
ansible-playbook -i inventory.ini playbooks/deploy-backend.yml \
  --limit staging \
  -e "db_password=xxx rabbitmq_password=xxx redis_password=xxx jwt_secret=xxx"
```

---

## Health Checks & Monitoring

### Service Health Endpoints

All services expose `/healthz`:

```bash
# Check all services
curl http://localhost:8080/healthz   # API Gateway
curl http://localhost:8090/healthz   # Search Service
curl http://localhost:8091/healthz  # Booking Service
curl http://localhost:8092/healthz   # Payment Service

# RabbitMQ Management
curl http://localhost:15672/api/overview  # Requires auth

# Redis
docker compose exec redis redis-cli ping
```

### Backup Strategy

```bash
# PostgreSQL backup
docker compose exec -T postgres pg_dump -U flightbooking flightbooking > backup_$(date +%Y%m%d_%H%M%S).sql

# Automated backup script
cat > scripts/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=./backups
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d_%H%M%S)

# DB backup
docker compose exec -T postgres pg_dump -U flightbooking flightbooking | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Redis backup
docker compose exec -T redis redis-cli SAVE

# Keep last 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
echo "Backup completed: $DATE"
EOF
chmod +x scripts/backup.sh

# Cron job (run daily at 3 AM)
# 0 3 * * * ~/flight-booking/be/scripts/backup.sh >> ~/flight-booking/be/backups/backup.log 2>&1
```

---

## Troubleshooting

### Common Issues

**Services won't start**
```bash
# Check logs
docker compose logs -f

# Check port conflicts
ss -tlnp | grep -E '8080|8090|8091|8092|5432|6379|5672|15672'

# Restart services
docker compose restart
```

**PostgreSQL connection fails**
```bash
# Check if postgres is healthy
docker compose ps postgres

# Check postgres logs
docker compose logs postgres

# Connect manually
docker compose exec postgres psql -U flightbooking -d flightbooking
```

**Redis OOM (Out of Memory)**
```bash
# Check memory usage
docker compose exec redis redis-cli info memory

# Check connected clients
docker compose exec redis redis-cli client list

# Flush if needed (dev only!)
docker compose exec redis redis-cli FLUSHALL
```

**CORS errors in production**
```bash
# Verify CORS settings
curl -H "Origin: https://yourdomain.com" -I http://localhost:8080/healthz
# Should return: Access-Control-Allow-Origin: https://yourdomain.com
```

**JWT authentication fails**
```bash
# Check JWT secret matches between services
docker compose exec api-gateway env | grep JWT

# Generate new secret
openssl rand -base64 64
```

**RabbitMQ queues growing**
```bash
# Check queue status
docker compose exec rabbitmq rabbitmqctl list_queues name messages consumers
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] All secrets generated and stored securely
- [ ] Domain DNS configured
- [ ] SSL certificates active (via Cloudflare or Let's Encrypt)
- [ ] Firewall rules configured
- [ ] Backup strategy in place
- [ ] Monitoring stack deployed

### Post-Deployment
- [ ] All health endpoints return 200
- [ ] API Gateway responds to requests
- [ ] CORS configured correctly
- [ ] JWT authentication working
- [ ] Prometheus scraping all targets
- [ ] Grafana dashboards populated
- [ ] Cloudflare Tunnel connected
- [ ] Backup script tested
- [ ] Log rotation configured
