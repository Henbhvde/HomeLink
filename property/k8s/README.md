# Kubernetes deployment

Create `homelink-secrets` externally with `POSTGRES_URL`, `REDIS_URL`, `JWT_SECRET`, `OTP_PROVIDER_API_KEY`, `NOTIFICATION_PROVIDER_API_KEY`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `QPAY_WEBHOOK_SECRET`, and `BANK_WEBHOOK_SECRET`. Replace example hosts/images, then run `kubectl apply -k k8s`. Build the migration image from backend Docker target `migrate`.
