#!/bin/bash
# backup.sh — mysqldump local a /tmp
# Uso: bash scripts/backup.sh
# Cron diario: 0 3 * * * /opt/atlas/scripts/backup.sh >> /var/log/atlas-backup.log 2>&1
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../backend/.env"

# Cargar variables del .env si existe
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | grep -E '^(DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_NAME)=' | xargs)
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-lobo_user}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-inversiones_db}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-lobo-mysql}"

BACKUP_DIR="/tmp/atlas-backups"
DATE=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="$BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando backup de $DB_NAME..."

# Usar docker exec si mysqldump no está disponible localmente
if command -v mysqldump &>/dev/null; then
  mysqldump \
    -h "$DB_HOST" \
    -P "$DB_PORT" \
    -u "$DB_USER" \
    -p"$DB_PASSWORD" \
    --single-transaction \
    --no-tablespaces \
    --routines \
    --triggers \
    "$DB_NAME" | gzip > "$DUMP_FILE"
else
  docker exec "$MYSQL_CONTAINER" mysqldump \
    -u "$DB_USER" \
    -p"$DB_PASSWORD" \
    --single-transaction \
    --no-tablespaces \
    --routines \
    --triggers \
    "$DB_NAME" | gzip > "$DUMP_FILE"
fi

SIZE=$(du -sh "$DUMP_FILE" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup creado: $DUMP_FILE ($SIZE)"

# Limpiar backups antiguos (retención $RETENTION_DAYS días)
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS -delete
REMAINING=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" | wc -l)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backups retenidos: $REMAINING"
