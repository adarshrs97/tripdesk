#!/usr/bin/env bash
# ==============================================================================
# Starciti Fleet & Billing Desk - Automated Daily Database Backup
# Target: PostgreSQL / Supabase
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/starciti_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting Starciti database backup..."

if [ -n "${DATABASE_URL:-}" ]; then
  # Direct PostgreSQL Connection String
  pg_dump "${DATABASE_URL}" --clean --if-exists --no-owner --no-privileges | gzip > "${BACKUP_FILE}"
elif [ -n "${SUPABASE_DB_URL:-}" ]; then
  # Supabase Cloud Direct DB URL
  pg_dump "${SUPABASE_DB_URL}" --clean --if-exists --no-owner --no-privileges | gzip > "${BACKUP_FILE}"
else
  # Local Docker Fallback
  docker exec -i starciti_postgres pg_dump -U postgres -d starciti --clean --if-exists --no-owner --no-privileges | gzip > "${BACKUP_FILE}"
fi

FILESIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
echo "[$(date)] Backup completed successfully: ${BACKUP_FILE} (${FILESIZE})"

# Retain backups for 30 days
find "${BACKUP_DIR}" -name "starciti_backup_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete
echo "[$(date)] Pruned backups older than ${RETENTION_DAYS} days."
