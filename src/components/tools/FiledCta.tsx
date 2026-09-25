import { FaWhatsapp } from 'react-icons/fa';
import { whatsappUrl } from '@/lib/contact';
import { site } from '@/config/site';

/**
 * "Get this filed for you" button for calculator results. The message names the tool only;
 * personal amounts are included only when the user ticks the opt-in (`details`).
 */
export default function FiledCta({ tool, details }: { tool: string; details?: string }) {
  const base = `Hello ${site.owner.name}, I used the ${tool} on your website and would like help filing.`;
  const href = whatsappUrl(details ? `${base}\n\n${details}` : base) ?? '/contact';
  return (
    <a className="btn btn--whatsapp" href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener">
      <FaWhatsapp aria-hidden="true" /> Get this filed for you
    </a>
  );
}
