import { readFileSync } from 'node:fs';

export function getSecret(name: string) {
  const file = process.env[`${name}_FILE`];
  const value = file ? readFileSync(file, 'utf8').trim() : process.env[name];
  if (!value) throw new Error(`${name} must be provided by the environment or secret manager mount.`);
  return value;
}
