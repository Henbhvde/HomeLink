import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoOtpEnabled, sendPasswordResetOtp } from './otpProvider.js';

describe('OTP provider', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; vi.restoreAllMocks(); });
  it('never enables demo OTP in production and sends through provider', async () => {
    process.env.NODE_ENV = 'production'; process.env.ALLOW_DEMO_OTP = 'true';
    process.env.OTP_EMAIL_PROVIDER_URL = 'https://mail.test/send'; process.env.OTP_PROVIDER_API_KEY = 'secret';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 202 }));
    expect(demoOtpEnabled()).toBe(false);
    await sendPasswordResetOtp({ email: 'user@test.mn', code: '123456' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
