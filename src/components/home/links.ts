/**
 * Contact links for the home sections. When the owner has not set a number yet, links fall back to
 * /contact with a visible "TODO" title, matching ContactButtons.astro.
 */
import { defaultWhatsappMessage, telUrl, whatsappUrl } from '@/lib/contact';

export interface LinkAttrs {
  href: string;
  target?: string;
  rel?: string;
  title?: string;
}

export function waLink(topic?: string): LinkAttrs {
  const url = whatsappUrl(defaultWhatsappMessage(topic));
  return url ? { href: url, target: '_blank', rel: 'noopener' } : { href: '/contact', title: 'TODO: WhatsApp number not set' };
}

export function callLink(): LinkAttrs {
  const url = telUrl();
  return url ? { href: url } : { href: '/contact', title: 'TODO: phone number not set' };
}
