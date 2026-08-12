const placeholders = ['replace-with', 'change-me', 'your-'];

export function corsAllowlist() {
  const configured = process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL;
  if (!configured) {
    if (process.env.NODE_ENV === 'production') throw new Error('FRONTEND_URLS is required in production.');
    return ['http://localhost:5174'];
  }
  return configured.split(',').map((value) => value.trim()).filter(Boolean);
}

export function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== 'production') return;
  for (const name of ['POSTGRES_URL', 'JWT_SECRET']) {
    const value = process.env[name];
    if (!value || placeholders.some((item) => value.toLowerCase().includes(item))) throw new Error(`${name} is missing or uses a placeholder.`);
  }
  if (process.env.JWT_SECRET!.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');
  if (corsAllowlist().some((origin) => !origin.startsWith('https://'))) throw new Error('Production CORS origins must use HTTPS.');
  if (process.env.ALLOW_DEMO_OTP === 'true') throw new Error('Demo OTP must be disabled in production.');
}
