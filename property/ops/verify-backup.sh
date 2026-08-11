#!/usr/bin/env bash
set -euo pipefail
: "${1:?Usage: verify-backup.sh BACKUP_DIRECTORY}"
backup="$(realpath "$1")"
(cd "$backup" && sha256sum --check SHA256SUMS)
pg_restore --list "$backup/postgres.dump" >/dev/null
echo "Backup verified: $backup"
