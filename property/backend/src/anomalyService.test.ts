import { describe, expect, it } from 'vitest';
import { detectMeterAnomalies, detectPaymentAnomalies, type MeterReading, type Payment } from './anomalyService.js';

describe('detectMeterAnomalies', () => {
  it('detects negative usage or currentValue < previousValue', () => {
    const readings: MeterReading[] = [
      { id: 'r1', meterId: 'm1', currentValue: 90, previousValue: 100, usage: -10, readAt: '2026-08-01T10:00:00Z' },
    ];
    const alerts = detectMeterAnomalies(readings);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('high');
    expect(alerts[0].message).toContain('Сөрөг хэрэглээ');
  });

  it('detects unusually high usage compared to average', () => {
    const readings: MeterReading[] = [
      { id: 'r1', meterId: 'm1', currentValue: 10, previousValue: 0, usage: 10, readAt: '2026-08-01T10:00:00Z' },
      { id: 'r2', meterId: 'm1', currentValue: 20, previousValue: 10, usage: 10, readAt: '2026-08-02T10:00:00Z' },
      { id: 'r3', meterId: 'm1', currentValue: 60, previousValue: 20, usage: 40, readAt: '2026-08-03T10:00:00Z' },
    ];
    const alerts = detectMeterAnomalies(readings);
    // r3 usage (40) is 4x the average of r1, r2 (10), which is > 3x average
    expect(alerts.some(a => a.entityId === 'r3' && a.severity === 'medium')).toBe(true);
  });

  it('detects broken/stuck meter (0 usage when historical average was > 10)', () => {
    const readings: MeterReading[] = [
      { id: 'r1', meterId: 'm1', currentValue: 20, previousValue: 0, usage: 20, readAt: '2026-08-01T10:00:00Z' },
      { id: 'r2', meterId: 'm1', currentValue: 40, previousValue: 20, usage: 20, readAt: '2026-08-02T10:00:00Z' },
      { id: 'r3', meterId: 'm1', currentValue: 40, previousValue: 40, usage: 0, readAt: '2026-08-03T10:00:00Z' },
    ];
    const alerts = detectMeterAnomalies(readings);
    expect(alerts.some(a => a.entityId === 'r3' && a.message.includes('гацсан эсвэл гэмтсэн'))).toBe(true);
  });

  it('detects duplicate readings on the same day for a meter', () => {
    const readings: MeterReading[] = [
      { id: 'r1', meterId: 'm1', currentValue: 10, previousValue: 0, usage: 10, readAt: '2026-08-01T10:00:00Z' },
      { id: 'r2', meterId: 'm1', currentValue: 12, previousValue: 10, usage: 2, readAt: '2026-08-01T18:00:00Z' },
    ];
    const alerts = detectMeterAnomalies(readings);
    expect(alerts.some(a => a.severity === 'info' && a.message.includes('Нэг өдөр ижил тоолуурт'))).toBe(true);
  });
});

describe('detectPaymentAnomalies', () => {
  it('detects duplicate transaction reference', () => {
    const payments: Payment[] = [
      { id: 'p1', reference: 'REF123', amount: 50000, createdAt: '2026-08-01T10:00:00Z' },
      { id: 'p2', reference: 'REF123', amount: 50000, createdAt: '2026-08-01T11:00:00Z' },
    ];
    const alerts = detectPaymentAnomalies(payments);
    expect(alerts.filter(a => a.message.includes('давхардсан')).length).toBe(2);
  });

  it('detects unusually large payment amount', () => {
    const payments: Payment[] = [
      { id: 'p1', reference: 'REF1', amount: 2000000, createdAt: '2026-08-01T10:00:00Z' },
    ];
    const alerts = detectPaymentAnomalies(payments);
    expect(alerts.some(a => a.severity === 'medium' && a.message.includes('Хэт өндөр дүнтэй'))).toBe(true);
  });

  it('detects rapid successive payments', () => {
    const payments: Payment[] = [
      { id: 'p1', reference: 'REF1', amount: 50000, createdAt: '2026-08-01T10:00:00Z' },
      { id: 'p2', reference: 'REF1', amount: 50000, createdAt: '2026-08-01T10:00:30Z' }, // 30 seconds diff
    ];
    const alerts = detectPaymentAnomalies(payments);
    expect(alerts.some(a => a.severity === 'high' && a.message.includes('богино хугацаанд давхардсан'))).toBe(true);
  });

  it('detects suspicious off-hours transaction', () => {
    const payments: Payment[] = [
      { id: 'p1', reference: 'REF1', amount: 50000, createdAt: '2026-08-01T03:30:00Z' }, // 3:30 AM
    ];
    const alerts = detectPaymentAnomalies(payments);
    expect(alerts.some(a => a.severity === 'info' && a.message.includes('Сэжигтэй цагаар'))).toBe(true);
  });

  it('detects multi-attempt velocity limit from same resident', () => {
    const payments: Payment[] = [
      { id: 'p1', reference: 'REF1', amount: 10000, createdAt: '2026-08-01T10:00:00Z', residentProfileId: 'res1' },
      { id: 'p2', reference: 'REF2', amount: 10000, createdAt: '2026-08-01T10:02:00Z', residentProfileId: 'res1' },
      { id: 'p3', reference: 'REF3', amount: 10000, createdAt: '2026-08-01T10:05:00Z', residentProfileId: 'res1' },
      { id: 'p4', reference: 'REF4', amount: 10000, createdAt: '2026-08-01T10:07:00Z', residentProfileId: 'res1' },
    ];
    const alerts = detectPaymentAnomalies(payments);
    expect(alerts.some(a => a.severity === 'medium' && a.message.includes('олон төлбөр хийх оролдлого'))).toBe(true);
  });
});
