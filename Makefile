# Flight Booking — Go Backend
# Clean Architecture / DDD / Hexagonal Architecture
# Located in: be-flight-booking/

.SHELLFLAGS := -o pipefail -c
.ONESHELL:
MAKEFLAGS += --jobs=4

GOCMD      := go
GOBUILD    := $(GOCMD) build
GOTEST     := $(GOCMD) test
GOMOD      := $(GOCMD) mod
GOFMT      := $(GOCMD) fmt
GOVET      := $(GOCMD) vet
GO_VERSION := 1.23
GOOS       := linux
GOARCH     := amd64

ROOT_DIR      := $(shell pwd -W 2>/dev/null || pwd)
PKG_DIR       := $(ROOT_DIR)/pkg
APPS_DIR      := $(ROOT_DIR)/apps
PROTO_DIR     := $(ROOT_DIR)/proto
SCRIPTS_DIR   := $(ROOT_DIR)/scripts
BUILD_DIR     := $(ROOT_DIR)/dist

SERVICES := api-gateway search-service booking-service payment-service

REGISTRY    ?= localhost:5000
IMAGE_PREFIX := flight-booking

DB_HOST     ?= localhost
DB_PORT     ?= 5432
DB_USER     ?= flightbooking
DB_PASSWORD ?= flightbooking123
DB_NAME     ?= flightbooking
DB_URL      ?= postgres://$(DB_USER):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?sslmode=disable

BOLD   := $(shell printf '\033[1m')
RESET  := $(shell printf '\033[0m')
GREEN  := $(shell printf '\033[32m')
CYAN   := $(shell printf '\033[36m')

.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(BOLD)$(CYAN%-22s$(RESET) %s\n", $$1, $$2}'

# ─── Build ─────────────────────────────────────────────────────────────────────
.PHONY: build/all
build/all:
	@echo "$(GREEN)Building all services...$(RESET)"
	@mkdir -p $(BUILD_DIR)
	@$(MAKE) $(addprefix build/,$(SERVICES))

$(foreach svc,$(SERVICES),$(eval \
build/$(svc)::
	@echo "$(GREEN)Building $(svc)...$(RESET)" && \
	mkdir -p $(BUILD_DIR)/$(svc) && \
	cd $(APPS_DIR)/$(svc) && \
	CGO_ENABLED=0 GOOS=$(GOOS) GOARCH=$(GOARCH) $(GOBUILD) \
		-a -installsuffix cgo -ldflags " \
			-X main.version=$$(git describe --tags --always --dirty 2>/dev/null || echo 'dev') \
			-s -w" \
		-o $(BUILD_DIR)/$(svc)/$(svc) . \
))

.PHONY: build SERVICE=api-gateway
build:
	@echo "$(GREEN)Building $(SERVICE)...$(RESET)"
	@mkdir -p $(BUILD_DIR)/$(SERVICE)
	@cd $(APPS_DIR)/$(SERVICE) && \
	CGO_ENABLED=0 GOOS=$(GOOS) GOARCH=$(GOARCH) $(GOBUILD) \
		-a -installsuffix cgo -ldflags " \
			-X main.version=$$(git describe --tags --always --dirty 2>/dev/null || echo 'dev') \
			-s -w" \
		-o $(BUILD_DIR)/$(SERVICE)/$(SERVICE) .

# ─── Docker ─────────────────────────────────────────────────────────────────────
.PHONY: docker/build-all
docker/build-all:
	@echo "$(GREEN)Building Docker images...$(RESET)"
	@$(MAKE) $(addprefix docker/build/,$(SERVICES))

$(foreach svc,$(SERVICES),$(eval \
docker/build/$(svc)::
	@echo "$(GREEN)Building Docker image: $(svc)...$(RESET)" && \
	docker build \
		-t $(IMAGE_PREFIX)/$(svc):latest \
		-f $(APPS_DIR)/$(svc)/Dockerfile $(APPS_DIR)/$(svc) \
))

.PHONY: docker/up
docker/up:
	@docker compose -f $(ROOT_DIR)/docker-compose.yml up -d --build

.PHONY: docker/down
docker/down:
	@docker compose -f $(ROOT_DIR)/docker-compose.yml down

.PHONY: docker/logs SERVICE=api-gateway
docker/logs:
	@docker compose -f $(ROOT_DIR)/docker-compose.yml logs -f $(SERVICE)

# ─── Database ───────────────────────────────────────────────────────────────────
.PHONY: db/migrate
db/migrate:
	@echo "$(GREEN)Running migrations...$(RESET)"
	@docker compose -f $(ROOT_DIR)/docker-compose.yml exec postgres \
		psql -U $(DB_USER) -d $(DB_NAME) -f /migrations/001_initial_schema.sql

# ─── Quality ──────────────────────────────────────────────────────────────────
.PHONY: fmt
fmt:
	@echo "$(GREEN)Formatting Go code...$(RESET)"
	@find $(PKG_DIR) $(APPS_DIR) -name '*.go' | xargs $(GOFMT) -s -w

.PHONY: vet
vet:
	@echo "$(GREEN)Running go vet...$(RESET)"
	@find $(PKG_DIR) $(APPS_DIR) -name '*.go' | xargs $(GOVET) ./...

.PHONY: test
test:
	@echo "$(GREEN)Running tests...$(RESET)"
	@$(GOTEST) -v -race ./pkg/... ./apps/...

# ─── Deploy ─────────────────────────────────────────────────────────────────────
.PHONY: deploy SERVICE=api-gateway
deploy:
	@bash $(SCRIPTS_DIR)/deploy.sh $(SERVICE)

# ─── Dev ─────────────────────────────────────────────────────────────────────────
.PHONY: dev SERVICE=api-gateway
dev:
	@cd $(APPS_DIR)/$(SERVICE) && $(GOCMD) run .

.PHONY: setup
setup: fmt
	@echo "$(GREEN)Setting up...$(RESET)"

.PHONY: clean
clean:
	@echo "$(GREEN)Cleaning...$(RESET)"
	@rm -rf $(BUILD_DIR)
