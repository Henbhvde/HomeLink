import { createHash } from 'node:crypto';

const knownBreached = new Set(['password123!', 'qwerty123456', 'admin123456!']);
export async function isBreachedPassword(password: string) {
  if (knownBreached.has(password.toLowerCase())) return true;
  const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, { headers: { 'Add-Padding': 'true', 'User-Agent': 'HomeLink-password-check' }, signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error('Breached-password service unavailable.');
    return (await response.text()).split('\n').some((line) => line.split(':')[0]?.trim() === hash.slice(5));
  } catch (error) { if (process.env.NODE_ENV === 'production') throw error; return false; }
}
