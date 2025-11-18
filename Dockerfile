FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create public/images/routes directory for uploaded images
RUN mkdir -p public/images/routes

# Make scripts executable
RUN chmod +x docker/*.sh || true

# Expose ports for all services
EXPOSE 3000 4001 4002 4003 4004 4005

# Default command (will be overridden by docker-compose)
CMD ["node", "dist/api-gateway/main.js"]

