export type TemplateKey =
  | 'invoice_sent'
  | 'invite_sent'
  | 'payment_received'
  | 'maintenance_updated'
  | 'announcement_created';

export const templates: Record<TemplateKey, Record<'mn' | 'en', { title: string; body: string }>> = {
  invoice_sent: {
    mn: {
      title: 'Шинэ нэхэмжлэл',
      body: 'Таны шинэ нэхэмжлэл илгээгдлээ.',
    },
    en: {
      title: 'New Invoice',
      body: 'Your new invoice has been sent.',
    },
  },
  invite_sent: {
    mn: {
      title: 'HomeLink урилга',
      body: 'Урилгаа хүлээн авах: {link}',
    },
    en: {
      title: 'HomeLink Invitation',
      body: 'Receive your invitation here: {link}',
    },
  },
  payment_received: {
    mn: {
      title: 'Төлбөр баталгаажлаа',
      body: 'Таны {reference} дугаартай, {amount} дүнтэй төлбөр амжилттай баталгаажлаа.',
    },
    en: {
      title: 'Payment Confirmed',
      body: 'Your payment of {amount} with reference {reference} has been successfully confirmed.',
    },
  },
  maintenance_updated: {
    mn: {
      title: 'Засварын хүсэлт шинэчлэгдлээ',
      body: 'Таны {id} дугаартай засварын хүсэлтийн төлөв "{status}" болж өөрчлөгдлөө.',
    },
    en: {
      title: 'Maintenance Request Updated',
      body: 'Your maintenance request {id} status has been updated to "{status}".',
    },
  },
  announcement_created: {
    mn: {
      title: 'Шинэ зар тавигдлаа',
      body: 'Шинэ зар: {title}',
    },
    en: {
      title: 'New Announcement',
      body: 'New announcement: {title}',
    },
  },
};

export function renderTemplate(
  key: TemplateKey,
  lang: 'mn' | 'en' = 'mn',
  variables: Record<string, string> = {}
): { title: string; body: string } {
  const chosenLang = lang === 'en' ? 'en' : 'mn';
  const template = templates[key]?.[chosenLang] || templates[key]?.['mn'];
  if (!template) {
    return { title: '', body: '' };
  }

  let title = template.title;
  let body = template.body;
  for (const [vKey, vVal] of Object.entries(variables)) {
    title = title.replaceAll(`{${vKey}}`, vVal);
    body = body.replaceAll(`{${vKey}}`, vVal);
  }

  return { title, body };
}
