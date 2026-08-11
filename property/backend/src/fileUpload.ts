const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
export const uploadLimits = { maxFiles: 5, maxBytes: 5 * 1024 * 1024 } as const;
type Upload = { mimeType: string; bytes: Buffer };
export type MalwareScanHook = (upload: Upload) => Promise<boolean>;

let malwareScan: MalwareScanHook = async ({ bytes }) => !bytes.toString('utf8').includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE');
export const setMalwareScanHook = (hook: MalwareScanHook) => { malwareScan = hook; };
export function parseDataUrl(value: string) {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match || !allowedTypes.has(match[1])) throw new Error('Unsupported attachment type.');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > uploadLimits.maxBytes) throw new Error('Attachment exceeds 5 MB.');
  return { mimeType: match[1], bytes };
}

export async function validateEmbeddedUploads(value: unknown) {
  const uploads: Upload[] = [];
  const visit = (item: unknown) => {
    if (typeof item === 'string' && item.startsWith('data:')) {
      uploads.push(parseDataUrl(item));
    } else if (Array.isArray(item)) item.forEach(visit);
    else if (typeof item === 'object' && item !== null) Object.values(item).forEach(visit);
  };
  visit(value);
  if (uploads.length > uploadLimits.maxFiles) throw new Error('Maximum 5 attachments are allowed.');
  for (const upload of uploads) if (!await malwareScan(upload)) throw new Error('Attachment failed malware scan.');
}
