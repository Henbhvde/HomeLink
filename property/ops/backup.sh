#!/usr/bin/env bash
set -euo pipefail
: "${POSTGRES_URL:?POSTGRES_URL is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="${BACKUP_DIR%/}/${timestamp}"
mkdir -p "$target"

pg_dump "$POSTGRES_URL" --format=custom --compress=9 --no-owner --no-acl --file="$target/postgres.dump"

case "${UPLOAD_BACKUP_MODE:-s3}" in
  s3)
    : "${S3_BUCKET:?S3_BUCKET is required}"
    aws s3 sync "s3://${S3_BUCKET}" "$target/uploads" --only-show-errors
    ;;
  local)
    : "${UPLOAD_DIR:?UPLOAD_DIR is required}"
    tar -C "$UPLOAD_DIR" -czf "$target/uploads.tar.gz" .
    ;;
  *) echo "UPLOAD_BACKUP_MODE must be s3 or local" >&2; exit 2 ;;
esac

printf '{"createdAt":"%s","mode":"%s"}\n' "$timestamp" "${UPLOAD_BACKUP_MODE:-s3}" > "$target/manifest.json"
(cd "$target" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)
echo "Backup created: $target"
