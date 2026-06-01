# =============================================================================
# Flight Booking — Automated Backup Script
# be-flight-booking/scripts/backup.sh
#
# Schedule with cron:
#   0 3 * * * /home/deploy/flight-booking/be/scripts/backup.sh >> /home/deploy/flight-booking/backups/backup.log 2>&1
#
# For automatic cleanup of old backups, add to crontab:
#   0 4 * * * find /home/deploy/flight-booking/backups -name "*.gz" -mtime +30 -delete
# =============================================================================

#!/bin/bash

set -euo pipefail

# ─── Configuration ─────────────────────────────────────────────────────────────
BACKUP_DIR="/home/deploy/flight-booking/backups"
APP_DIR="/home/deploy/flight-booking/be"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)

# ─── Setup ───────────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
echo "=== Backup started at $(date) ==="

# ─── PostgreSQL Backup ────────────────────────────────────────────────────────
echo "[1/4] Backing up PostgreSQL..."
PG_CONTAINER=$(docker compose -f "$APP_DIR/docker-compose.yml" ps -q postgres 2>/dev/null || echo "")

if [ -n "$PG_CONTAINER" ]; then
    BACKUP_FILE="$BACKUP_DIR/db_backup_${DATE}.sql.gz"
    docker compose -f "$APP_DIR/docker-compose.yml" exec -T postgres pg_dump -U flightbooking flightbooking 2>/dev/null | gzip > "$BACKUP_FILE"
    echo "  -> Saved: db_backup_${DATE}.sql.gz ($(du -h "$BACKUP_FILE" | cut -f1))"
else
    echo "  -> PostgreSQL container not running, skipping..."
fi

# ─── Redis Backup ─────────────────────────────────────────────────────────────
echo "[2/4] Triggering Redis save..."
REDIS_CONTAINER=$(docker compose -f "$APP_DIR/docker-compose.yml" ps -q redis 2>/dev/null || echo "")

if [ -n "$REDIS_CONTAINER" ]; then
    docker compose -f "$APP_DIR/docker-compose.yml" exec -T redis redis-cli SAVE > /dev/null 2>&1
    # Copy Redis RDB file
    docker compose -f "$APP_DIR/docker-compose.yml" cp redis:/data/dump.rdb "$BACKUP_DIR/redis_backup_${DATE}.rdb" 2>/dev/null || true
    echo "  -> Redis snapshot saved"
else
    echo "  -> Redis container not running, skipping..."
fi

# ─── RabbitMQ Definitions Backup ─────────────────────────────────────────────
echo "[3/4] Backing up RabbitMQ definitions..."
RABBITMQ_CONTAINER=$(docker compose -f "$APP_DIR/docker-compose.yml" ps -q rabbitmq 2>/dev/null || echo "")

if [ -n "$RABBITMQ_CONTAINER" ]; then
    docker compose -f "$APP_DIR/docker-compose.yml" exec -T rabbitmq rabbitmqctl export_definitions /tmp/rabbit_definitions.json 2>/dev/null || true
    docker compose -f "$APP_DIR/docker-compose.yml" cp rabbitmq:/tmp/rabbit_definitions.json "$BACKUP_DIR/rabbitmq_definitions_${DATE}.json" 2>/dev/null || true
    echo "  -> RabbitMQ definitions saved"
else
    echo "  -> RabbitMQ container not running, skipping..."
fi

# ─── Cleanup Old Backups ──────────────────────────────────────────────────────
echo "[4/4] Cleaning up backups older than $RETENTION_DAYS days..."
DELETED_COUNT=$(find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
DELETED_COUNT_JSON=$(find "$BACKUP_DIR" -name "*.json" -mtime +$RETENTION_DAYS -delete -print | wc -l)
DELETED_COUNT_RDB=$(find "$BACKUP_DIR" -name "*.rdb" -mtime +$RETENTION_DAYS -delete -print | wc -l)
echo "  -> Deleted $((DELETED_COUNT + DELETED_COUNT_JSON + DELETED_COUNT_RDB)) old backup files"

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "=== Backup completed at $(date) ==="
echo "Backup directory: $BACKUP_DIR"
echo "Files:"
du -h "$BACKUP_DIR"/*_"${DATE}"* 2>/dev/null || echo "  (no new files)"
echo ""
echo "Total backup size: $(du -sh "$BACKUP_DIR" | cut -f1)"
echo "Total files: $(find "$BACKUP_DIR" -type f | wc -l)"
