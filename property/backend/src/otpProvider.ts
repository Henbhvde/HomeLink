type OtpRecipient = { email: string; phone?: string | null; code: string };
export const demoOtpEnabled = () => process.env.NODE_ENV === 'development' && process.env.ALLOW_DEMO_OTP !== 'false';

export async function sendPasswordResetOtp({ email, phone, code }: OtpRecipient) {
  if (demoOtpEnabled()) { console.info(`Password reset OTP for ${email}: ${code}`); return; }
  const smsUrl = phone ? process.env.OTP_SMS_PROVIDER_URL : undefined;
  const url = smsUrl ?? process.env.OTP_EMAIL_PROVIDER_URL;
  const apiKey = process.env.OTP_PROVIDER_API_KEY;
  if (!url || !apiKey) throw new Error('OTP provider is not configured.');
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ channel: smsUrl ? 'sms' : 'email', to: smsUrl ? phone : email, template: 'password_reset', code, expiresInMinutes: 10 }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('OTP provider rejected the message.');
}
