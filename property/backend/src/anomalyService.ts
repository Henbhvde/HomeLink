export type MeterReading = {
  id: string;
  meterId: string;
  currentValue: number;
  previousValue: number;
  usage: number;
  readAt: string;
};

export type Payment = {
  id: string;
  reference: string;
  amount: number;
  paidAt?: string;
  createdAt: string;
  residentProfileId?: string | null;
};

export type AnomalyAlert = {
  type: 'meter' | 'payment';
  severity: 'high' | 'medium' | 'info';
  message: string;
  entityId: string;
  details: Record<string, any>;
};

export function detectMeterAnomalies(readings: MeterReading[]): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  const readingsByMeter: Record<string, MeterReading[]> = {};

  for (const r of readings) {
    if (!readingsByMeter[r.meterId]) readingsByMeter[r.meterId] = [];
    readingsByMeter[r.meterId].push(r);
  }

  for (const r of readings) {
    // 1. Negative usage or currentValue < previousValue
    if (r.usage < 0 || r.currentValue < r.previousValue) {
      alerts.push({
        type: 'meter',
        severity: 'high',
        message: 'Сөрөг хэрэглээ эсвэл заалт буурсан байна.',
        entityId: r.id,
        details: { meterId: r.meterId, usage: r.usage, current: r.currentValue, previous: r.previousValue },
      });
    }

    const meterReadings = readingsByMeter[r.meterId] || [];
    const validReadings = meterReadings.filter((x) => x.id !== r.id && x.usage >= 0);
    const avgUsage = validReadings.length > 0
      ? validReadings.reduce((sum, x) => sum + x.usage, 0) / validReadings.length
      : 0;

    // 2. Unusually high usage compared to average
    if (validReadings.length > 0 && avgUsage > 0 && r.usage > avgUsage * 3) {
      alerts.push({
        type: 'meter',
        severity: 'medium',
        message: 'Хэрэглээ хэвийн дунджаас 3 дахин давсан байна.',
        entityId: r.id,
        details: { meterId: r.meterId, usage: r.usage, average: avgUsage },
      });
    }

    // 3. Broken or Stuck Meter (0 usage when historical average was > 10)
    if (r.usage === 0 && validReadings.length >= 2 && avgUsage > 10) {
      alerts.push({
        type: 'meter',
        severity: 'medium',
        message: 'Тоолуур гацсан эсвэл гэмтсэн байж болзошгүй (Дундаж хэрэглээ өндөр боловч 0 заалттай).',
        entityId: r.id,
        details: { meterId: r.meterId, usage: r.usage, average: avgUsage },
      });
    }

    // 4. Duplicate readings on the same day for a meter
    const sameDayReadings = meterReadings.filter((x) => x.id !== r.id && x.readAt.split('T')[0] === r.readAt.split('T')[0]);
    if (sameDayReadings.length > 0) {
      alerts.push({
        type: 'meter',
        severity: 'info',
        message: 'Нэг өдөр ижил тоолуурт олон заалт бүртгэгдсэн байна.',
        entityId: r.id,
        details: { meterId: r.meterId, date: r.readAt.split('T')[0] },
      });
    }
  }

  return alerts;
}

export function detectPaymentAnomalies(payments: Payment[]): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  const referenceCounts: Record<string, number> = {};

  for (const p of payments) {
    referenceCounts[p.reference] = (referenceCounts[p.reference] || 0) + 1;
  }

  for (const p of payments) {
    // 1. Duplicate transaction reference
    if (referenceCounts[p.reference] > 1) {
      alerts.push({
        type: 'payment',
        severity: 'high',
        message: 'Төлбөрийн гүйлгээний утга давхардсан байна (Хуурамч гүйлгээ байх магадлалтай).',
        entityId: p.id,
        details: { reference: p.reference },
      });
    }

    // 2. Unusually large payment amount (> 1.5M MNT)
    if (p.amount > 1500000) {
      alerts.push({
        type: 'payment',
        severity: 'medium',
        message: 'Хэт өндөр дүнтэй гүйлгээ бүртгэгдсэн байна.',
        entityId: p.id,
        details: { amount: p.amount, reference: p.reference },
      });
    }

    // 3. Rapid successive payments (potential double charge / billing loop / attack)
    const sameRef = payments.filter((x) => x.id !== p.id && x.reference === p.reference);
    for (const other of sameRef) {
      const timeDiff = Math.abs(new Date(p.createdAt).getTime() - new Date(other.createdAt).getTime());
      if (timeDiff < 60000) {
        alerts.push({
          type: 'payment',
          severity: 'high',
          message: 'Маш богино хугацаанд давхардсан төлбөрийн оролдлого бүртгэгдсэн байна.',
          entityId: p.id,
          details: { reference: p.reference, timeDifferenceSeconds: timeDiff / 1000 },
        });
      }
    }

    // 4. Suspicious off-hours transaction (e.g. between 2:00 AM and 5:00 AM)
    const paymentHour = new Date(p.createdAt).getUTCHours();
    if (paymentHour >= 2 && paymentHour <= 5) {
      alerts.push({
        type: 'payment',
        severity: 'info',
        message: 'Сэжигтэй цагаар (шөнийн 2-5 цагийн хооронд) төлбөр хийгдсэн байна.',
        entityId: p.id,
        details: { hour: paymentHour, createdAt: p.createdAt },
      });
    }

    // 5. Multi-attempt velocity limit (high rate of payments from the same resident profile within short window)
    if (p.residentProfileId) {
      const tenantPayments = payments.filter(
        (x) => x.id !== p.id && x.residentProfileId === p.residentProfileId
      );
      const rapidAttempts = tenantPayments.filter((x) => {
        const timeDiff = Math.abs(new Date(p.createdAt).getTime() - new Date(x.createdAt).getTime());
        return timeDiff < 10 * 60 * 1000; // 10 minutes
      });
      if (rapidAttempts.length >= 3) {
        alerts.push({
          type: 'payment',
          severity: 'medium',
          message: 'Нэг хэрэглэгчээс богино хугацаанд (10 мин) олон төлбөр хийх оролдлого илэрсэн.',
          entityId: p.id,
          details: { residentProfileId: p.residentProfileId, count: rapidAttempts.length + 1 },
        });
      }
    }
  }

  return alerts;
}
