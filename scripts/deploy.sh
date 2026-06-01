#!/usr/bin/env bash
# Flight Booking — Deploy script for be-flight-booking/
# Usage: ./scripts/deploy.sh <service-name> [version]
# Example: ./scripts/deploy.sh api-gateway
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE="${1:-}"
VERSION="${2:-$(git describe --tags --always --dirty 2>/dev/null || echo 'dev')}"
REGISTRY="${REGISTRY:-localhost:5000}"
IMAGE_PREFIX="${IMAGE_PREFIX:-flight-booking}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

usage() {
    echo "Usage: $0 <service-name> [version]"
    echo "Services: api-gateway search-service booking-service payment-service"
    exit 1
}

if [[ -z "$SERVICE" ]]; then log_error "Service name required"; usage; fi

VALID_SERVICES=("api-gateway" "search-service" "booking-service" "payment-service")
if [[ ! " ${VALID_SERVICES[*]} " =~ " ${SERVICE} " ]]; then
    log_error "Invalid service: $SERVICE"
    usage
fi

log_info "Building $SERVICE (version: $VERSION)..."
cd "$ROOT_DIR/apps/$SERVICE"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags "-X main.version=$VERSION -X main.buildTime=$(date -u +'%Y-%m-%dT%H:%M:%SZ') -s -w" \
    -o "$SERVICE" .
log_info "Binary built successfully"

IMAGE_NAME="$IMAGE_PREFIX/$SERVICE:$VERSION"
LATEST_TAG="$IMAGE_PREFIX/$SERVICE:latest"

log_info "Building Docker image: $IMAGE_NAME..."
docker build \
    --build-arg SERVICE="$SERVICE" \
    --build-arg VERSION="$VERSION" \
    -t "$IMAGE_NAME" \
    -t "$LATEST_TAG" \
    -f Dockerfile .

log_info "Docker image built: $IMAGE_NAME"

if [[ "$REGISTRY" != "localhost"* ]]; then
    log_info "Pushing to registry: $REGISTRY..."
    docker tag "$IMAGE_NAME" "$REGISTRY/$IMAGE_NAME"
    docker tag "$IMAGE_NAME" "$REGISTRY/$LATEST_TAG"
    docker push "$REGISTRY/$IMAGE_NAME" &
    docker push "$REGISTRY/$LATEST_TAG" &
    wait
    log_info "Images pushed to $REGISTRY"
fi

log_info "Deploying $SERVICE..."
cd "$ROOT_DIR"
VERSION="$VERSION" docker compose up -d --build "$SERVICE"

PORT=8080
[[ "$SERVICE" == "search-service" ]]  && PORT=8090
[[ "$SERVICE" == "booking-service" ]] && PORT=8091
[[ "$SERVICE" == "payment-service" ]] && PORT=8092

log_info "Waiting for health check..."
for i in {1..30}; do
    if curl -sf "http://localhost:$PORT/healthz" > /dev/null 2>&1; then
        log_info "$SERVICE is healthy!"
        exit 0
    fi
    echo -n "."
    sleep 2
done

log_error "$SERVICE health check failed after 60s"
exit 1
