FROM node:20-alpine

WORKDIR /app

# Reduce npm hang risk: timeout and retries
ENV NPM_CONFIG_FETCH_TIMEOUT=120000 \
    NPM_CONFIG_FETCH_RETRIES=3

# Install netcat for TCP healthchecks (microservices use TCP, not HTTP)
RUN apk add --no-cache netcat-openbsd

# Install dependencies (npm ci is faster and more reliable when lockfile exists)
COPY package*.json ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create public/images/routes directory for uploaded images
RUN mkdir -p public/images/routes

# Make scripts executable and fix CRLF -> LF (Windows)
RUN chmod +x docker/*.sh 2>/dev/null || true && \
    (sed -i 's/\r$$//' docker/*.sh 2>/dev/null || true)

EXPOSE 3000

# Healthcheck for API Gateway
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Default command (will be overridden by docker-compose)
CMD ["node", "dist/api-gateway/main.js"]

