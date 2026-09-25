import { FaWhatsapp } from 'react-icons/fa';
import { ArrowRight, Phone } from 'lucide-react';
import { telUrl, whatsappUrl } from '@/lib/contact';
import { site } from '@/config/site';
import { ShareOptIn } from './sc-fields';

/**
 * "Get this filed for you" button for calculator results. The message names the tool only;
 * personal amounts are included only when the user ticks the opt-in (`details`).
 */
export default function FiledCta({ tool, details }: { tool: string; details?: string }) {
  const base = `Hello ${site.owner.name}, I used the ${tool} on your website and would like help filing.`;
  const href = whatsappUrl(details ? `${base}\n\n${details}` : base) ?? '/contact';
  return (
    <a
      className="btn btn--whatsapp ws-wa"
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel="noopener"
    >
      <FaWhatsapp aria-hidden="true" /> Get this filed for you
    </a>
  );
}

/**
 * The next-step row under every result: the opt-in (off by default), WhatsApp, Call, and a link to the
 * matching service page. `details` must already respect the opt-in: pass undefined unless `checked` is true.
 */
export function FiledPanel({
  tool,
  details,
  checked,
  onChange,
  optInLabel,
  title = 'Want this filed? Send it on WhatsApp.',
  service,
}: {
  tool: string;
  details?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  optInLabel?: string;
  title?: string;
  /** Service page for the "see the checklist" link. */
  service?: { href: string; label: string };
}) {
  const tel = telUrl();
  return (
    <div className="ws-filed">
      <p className="ws-filed__title">{title}</p>
      <p className="ws-filed__text">
        {site.owner.name} can check these figures and handle it for you, with a quote before any work starts. Nothing
        you typed leaves this page unless you tick the box.
      </p>
      <ShareOptIn checked={checked} onChange={onChange} label={optInLabel} />
      <div className="ws-filed__actions">
        <FiledCta tool={tool} details={details} />
        <a className="btn btn--ghost ws-filed__call" href={tel ?? '/contact'}>
          <Phone aria-hidden="true" /> Call
        </a>
      </div>
      {service && (
        <a className="ws-filed__link" href={service.href}>
          {service.label} <ArrowRight aria-hidden="true" />
        </a>
      )}
    </div>
  );
}
