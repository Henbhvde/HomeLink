# Backup and restore plan

## Objectives

- Target RPO: 15 minutes for Postgres, 24 hours for uploaded files.
- Target RTO: 4 hours.
- Keep daily backups for 35 days, monthly backups for 12 months, and yearly backups for 7 years.

## Production controls

1. Enable managed Postgres automated snapshots and WAL/PITR with at least 35-day retention.
2. Run `backup.sh` daily from an isolated job identity. Store backups in a separate encrypted bucket/account.
3. Enable S3 versioning, server-side KMS encryption, lifecycle retention, and Object Lock where available. Replicate critical uploads and database backups to a second region.
4. Restrict backup/restore credentials separately; application credentials must not delete backups. Alert on failed/missed backups and unexpected retention changes.
5. Verify every backup with `verify-backup.sh`. Perform a restore into an isolated environment quarterly, compare row/file counts, run application smoke tests, and record achieved RPO/RTO.

## Restore runbook

1. Declare the incident, stop writes/queue workers, select the newest verified recovery point, and preserve current data for forensics.
2. Restore into a new empty database by default. Use `RESTORE_REPLACE=true` only after explicit incident approval.
3. Restore files/versioned S3 objects, run `prisma migrate deploy`, validate tenant counts, invoice/payment totals, attachments, and authentication.
4. Rotate exposed credentials, switch traffic, monitor errors, and document the recovery. Never test restores against production.

Example:

```bash
BACKUP_DIR=/secure/backups POSTGRES_URL=... S3_BUCKET=... ./ops/backup.sh
RESTORE_CONFIRM=RESTORE POSTGRES_URL=... S3_BUCKET=... ./ops/restore.sh /secure/backups/20260802T120000Z
```
