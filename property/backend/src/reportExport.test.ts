import { describe, expect, it } from 'vitest';
import { renderExcel, renderPdf } from './reportExport.js';

describe('report exports', () => {
  it('generates real PDF and XLSX files', async () => {
    const rows = [{ number: 'INV-1', amount: 100 }];
    expect((await renderPdf('Нэхэмжлэл', rows)).subarray(0, 4).toString()).toBe('%PDF');
    expect((await renderExcel('Invoices', rows)).subarray(0, 2).toString()).toBe('PK');
  });
});
