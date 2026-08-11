#!/usr/bin/env bash
set -euo pipefail
: "${POSTGRES_URL:?POSTGRES_URL is required}"
: "${1:?Usage: restore.sh BACKUP_DIRECTORY}"
backup="$(realpath "$1")"
[[ -f "$backup/postgres.dump" && -f "$backup/SHA256SUMS" ]] || { echo "Invalid backup directory" >&2; exit 2; }
[[ "${RESTORE_CONFIRM:-}" == "RESTORE" ]] || { echo "Set RESTORE_CONFIRM=RESTORE to continue" >&2; exit 2; }
bash "$(dirname "$0")/verify-backup.sh" "$backup"

restore_args=(--no-owner --no-acl --exit-on-error --dbname "$POSTGRES_URL")
[[ "${RESTORE_REPLACE:-false}" == "true" ]] && restore_args=(--clean --if-exists "${restore_args[@]}")
pg_restore "${restore_args[@]}" "$backup/postgres.dump"

if [[ -d "$backup/uploads" ]]; then
  : "${S3_BUCKET:?S3_BUCKET is required}"
  aws s3 sync "$backup/uploads" "s3://${S3_BUCKET}" --only-show-errors
elif [[ -f "$backup/uploads.tar.gz" ]]; then
  : "${UPLOAD_DIR:?UPLOAD_DIR is required}"
  mkdir -p "$UPLOAD_DIR"
  tar -C "$UPLOAD_DIR" -xzf "$backup/uploads.tar.gz"
fi
echo "Restore completed from: $backup"
