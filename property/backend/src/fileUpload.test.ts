import { describe, expect, it } from 'vitest';
import { uploadLimits, validateEmbeddedUploads } from './fileUpload.js';

describe('file upload validation', () => {
  it('accepts allowed files and rejects type, size, count and malware', async () => {
    await expect(validateEmbeddedUploads({ attachment: 'data:image/png;base64,aGVsbG8=' })).resolves.toBeUndefined();
    await expect(validateEmbeddedUploads('data:text/html;base64,aGk=')).rejects.toThrow('type');
    const large = `data:image/png;base64,${Buffer.alloc(uploadLimits.maxBytes + 1).toString('base64')}`;
    await expect(validateEmbeddedUploads(large)).rejects.toThrow('5 MB');
    await expect(validateEmbeddedUploads(Array(6).fill('data:image/png;base64,aGk='))).rejects.toThrow('Maximum 5');
    const eicar = Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE').toString('base64');
    await expect(validateEmbeddedUploads(`data:application/pdf;base64,${eicar}`)).rejects.toThrow('malware');
  });
});
