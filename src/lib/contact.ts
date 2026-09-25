import { site } from '@/config/site';

/** WhatsApp click-to-chat link. Returns null when the number is not configured yet. */
export function whatsappUrl(message?: string): string | null {
  const n = site.contact.whatsapp;
  if (!n) return null;
  const q = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${n}${q}`;
}

export function telUrl(): string | null {
  return site.contact.phone ? `tel:+${site.contact.phone}` : null;
}

export function mailtoUrl(subject?: string, body?: string): string | null {
  const e = site.contact.email;
  if (!e) return null;
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  const q = params.toString().replace(/\+/g, '%20');
  return `mailto:${e}${q ? `?${q}` : ''}`;
}

/** Human-readable phone, e.g. "+91 98765 43210". */
export function formatPhone(e164: string | null): string | null {
  if (!e164) return null;
  const m = e164.match(/^91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : `+${e164}`;
}

export const defaultWhatsappMessage = (topic?: string) =>
  topic
    ? `Hello ${site.owner.name}, I need help with ${topic}.`
    : `Hello ${site.owner.name}, I'd like to ask about your tax filing services.`;
