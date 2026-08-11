import { describe, expect, it } from 'vitest';
import { renderTemplate } from './notificationTemplates.js';

describe('renderTemplate', () => {
  it('renders invoice_sent in Mongolian', () => {
    const t = renderTemplate('invoice_sent', 'mn');
    expect(t.title).toBe('Шинэ нэхэмжлэл');
    expect(t.body).toBe('Таны шинэ нэхэмжлэл илгээгдлээ.');
  });

  it('renders invoice_sent in English', () => {
    const t = renderTemplate('invoice_sent', 'en');
    expect(t.title).toBe('New Invoice');
    expect(t.body).toBe('Your new invoice has been sent.');
  });

  it('interpolates variables in Mongolian invite_sent', () => {
    const link = 'http://localhost/invite?token=123';
    const t = renderTemplate('invite_sent', 'mn', { link });
    expect(t.title).toBe('HomeLink урилга');
    expect(t.body).toContain(link);
  });

  it('interpolates variables in English invite_sent', () => {
    const link = 'http://localhost/invite?token=456';
    const t = renderTemplate('invite_sent', 'en', { link });
    expect(t.title).toBe('HomeLink Invitation');
    expect(t.body).toContain(link);
  });

  it('renders payment_received in Mongolian and English', () => {
    const tMn = renderTemplate('payment_received', 'mn', { reference: 'QPay-1002', amount: '25,000' });
    expect(tMn.title).toBe('Төлбөр баталгаажлаа');
    expect(tMn.body).toBe('Таны QPay-1002 дугаартай, 25,000 дүнтэй төлбөр амжилттай баталгаажлаа.');

    const tEn = renderTemplate('payment_received', 'en', { reference: 'QPay-1002', amount: '25,000' });
    expect(tEn.title).toBe('Payment Confirmed');
    expect(tEn.body).toBe('Your payment of 25,000 with reference QPay-1002 has been successfully confirmed.');
  });

  it('renders maintenance_updated in Mongolian and English', () => {
    const tMn = renderTemplate('maintenance_updated', 'mn', { id: 'REQ-456', status: 'Хийгдэж буй' });
    expect(tMn.title).toBe('Засварын хүсэлт шинэчлэгдлээ');
    expect(tMn.body).toBe('Таны REQ-456 дугаартай засварын хүсэлтийн төлөв "Хийгдэж буй" болж өөрчлөгдлөө.');

    const tEn = renderTemplate('maintenance_updated', 'en', { id: 'REQ-456', status: 'In Progress' });
    expect(tEn.title).toBe('Maintenance Request Updated');
    expect(tEn.body).toBe('Your maintenance request REQ-456 status has been updated to "In Progress".');
  });

  it('renders announcement_created in Mongolian and English', () => {
    const tMn = renderTemplate('announcement_created', 'mn', { title: 'Усны хязгаарлалт' });
    expect(tMn.title).toBe('Шинэ зар тавигдлаа');
    expect(tMn.body).toBe('Шинэ зар: Усны хязгаарлалт');

    const tEn = renderTemplate('announcement_created', 'en', { title: 'Water outage' });
    expect(tEn.title).toBe('New Announcement');
    expect(tEn.body).toBe('New announcement: Water outage');
  });
});
