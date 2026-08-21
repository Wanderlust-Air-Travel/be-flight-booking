#!/bin/sh
# Start all microservices from built dist, then API Gateway (foreground).
# Use in Docker so we run compiled JS instead of nest start --watch.

set -e
cd /app

echo "Starting microservices from dist..."

node dist/microservices/search/main.search.js &
node dist/microservices/services/main.services.js &
node dist/microservices/routes/main.routes.js &
node dist/microservices/booking/main.booking.js &
node dist/microservices/reservation/main.reservation.js &
node dist/microservices/payment/main.payment.js &
node dist/microservices/email/main.email.js &

echo "Waiting for microservices to bind..."
sleep 8

echo "Starting API Gateway..."
exec node dist/api-gateway/main.js
