import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

export const localUploadDirectory = join(process.cwd(), 'data', 'uploads');
export const createStorageKey = (tenantId: string, fileName: string) => `${tenantId}/${randomUUID()}${extname(fileName).toLowerCase().replace(/[^.a-z0-9]/g, '')}`;
type PutInput = { key: string; bytes: Buffer; mimeType: string };
export type FileStorage = { put(input: PutInput): Promise<string> };

class LocalStorage implements FileStorage {
  async put({ key, bytes }: PutInput) {
    const path = join(localUploadDirectory, ...key.split('/')); await mkdir(join(path, '..'), { recursive: true }); await writeFile(path, bytes);
    return `${process.env.API_PUBLIC_URL ?? 'http://localhost:3001'}/uploads/${key.split('/').map(encodeURIComponent).join('/')}`;
  }
}

const hmac = (key: Buffer | string, value: string) => createHmac('sha256', key).update(value).digest();
async function s3Put({ key, bytes, mimeType }: PutInput) {
  const endpoint = process.env.S3_ENDPOINT!; const bucket = process.env.S3_BUCKET!; const region = process.env.S3_REGION!;
  const accessKey = process.env.S3_ACCESS_KEY_ID!; const secretKey = process.env.S3_SECRET_ACCESS_KEY!;
  const url = new URL(`${endpoint.replace(/\/$/, '')}/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`);
  const now = new Date(); const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); const date = amzDate.slice(0, 8);
  const payloadHash = createHash('sha256').update(bytes).digest('hex');
  const canonicalHeaders = `content-type:${mimeType}\nhost:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonical = `PUT\n${url.pathname}\n\n${canonicalHeaders}${signedHeaders}\n${payloadHash}`;
  const scope = `${date}/${region}/s3/aws4_request`; const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${createHash('sha256').update(canonical).digest('hex')}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, date), region), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const response = await fetch(url, { method: 'PUT', body: new Uint8Array(bytes), headers: { 'Content-Type': mimeType, 'X-Amz-Date': amzDate, 'X-Amz-Content-Sha256': payloadHash, Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` } });
  if (!response.ok) throw new Error(`S3 upload failed (${response.status}).`);
  return `${process.env.S3_PUBLIC_URL!.replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export const createFileStorage = (): FileStorage => process.env.NODE_ENV === 'production' ? { put: s3Put } : new LocalStorage();
