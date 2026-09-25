import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react';
import { Send, TriangleAlert, RotateCcw } from 'lucide-react';
import { serviceNav } from '@/config/nav';
import { site } from '@/config/site';
import { mailtoUrl, telUrl, whatsappUrl, formatPhone } from '@/lib/contact';
import './ContactForm.css';

/**
 * Contact form island. POSTs JSON to PUBLIC_FORM_ENDPOINT (Formspree-style). If the endpoint is unset
 * or the request fails, it falls back to a pre-filled mailto: link, and if no email is configured
 * either, it points the visitor to WhatsApp / phone. Nothing is stored in the browser.
 */

type Field = 'name' | 'phone' | 'service' | 'message';
type Values = Record<Field, string> & { language: string; company: string };
type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; service: string; at: string }
  | { kind: 'mailto'; href: string; reason: 'no-endpoint' | 'failed' }
  | { kind: 'no-channel'; reason: 'no-endpoint' | 'failed' };

const OTHER = 'something-else';
const services = [...serviceNav.map((s) => ({ value: s.slug, label: s.title })), { value: OTHER, label: 'Something else' }];
const languages = ['English', 'Hindi', 'Other'];

const endpoint = (import.meta.env.PUBLIC_FORM_ENDPOINT as string | undefined)?.trim() || '';

/** Indian mobile: optional +91 / 91 / 0 prefix, then 10 digits starting 6–9. Spaces, dashes and brackets allowed. */
export function normaliseIndianMobile(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '').replace(/^\+/, '');
  const m = digits.match(/^(?:91|0)?([6-9]\d{9})$/);
  return m ? m[1] : null;
}

function validate(v: Values): Partial<Record<Field, string>> {
  const e: Partial<Record<Field, string>> = {};
  if (v.name.trim().length < 2) e.name = 'Please enter your name.';
  if (!v.phone.trim()) e.phone = 'Please enter your mobile number.';
  else if (!normaliseIndianMobile(v.phone)) e.phone = 'Enter a 10-digit Indian mobile number, for example 98765 43210.';
  if (!v.service) e.service = 'Please choose a service.';
  if (v.message.trim().length < 10) e.message = 'Please add a short message (at least 10 characters).';
  else if (v.message.length > 2000) e.message = 'Please keep the message under 2,000 characters.';
  return e;
}

const serviceLabel = (value: string) => services.find((s) => s.value === value)?.label ?? value;

const sentStatus = (service: string): Status => ({
  kind: 'sent',
  service: serviceLabel(service),
  at: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
});

function summary(v: Values): string {
  const mobile = normaliseIndianMobile(v.phone);
  return [
    `Name: ${v.name.trim()}`,
    `Mobile: ${mobile ? `+91 ${mobile}` : v.phone.trim()}`,
    `Service: ${serviceLabel(v.service)}`,
    v.language ? `Preferred language: ${v.language}` : null,
    '',
    v.message.trim(),
  ]
    .filter((l) => l !== null)
    .join('\n');
}

export default function ContactForm() {
  const uid = useId();
  const id = (f: string) => `${uid}-${f}`;
  const [values, setValues] = useState<Values>({ name: '', phone: '', service: '', message: '', language: '', company: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const receivedRef = useRef<HTMLDivElement>(null);
  const refs = {
    name: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    service: useRef<HTMLSelectElement>(null),
    message: useRef<HTMLTextAreaElement>(null),
  };

  // Preselect the service from ?service=<slug> (links from service pages).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('service');
    if (q && services.some((s) => s.value === q)) setValues((v) => ({ ...v, service: q }));
  }, []);

  // The form is replaced by the "received" slip: move focus there so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (status.kind === 'sent') receivedRef.current?.focus();
  }, [status.kind]);

  const set = (field: keyof Values, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    if (field !== 'language' && field !== 'company' && (touched[field] || errors[field])) {
      setErrors((e) => ({ ...e, [field]: validate(next)[field] }));
    }
  };

  const blur = (field: Field) => {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors((e) => ({ ...e, [field]: validate(values)[field] }));
  };

  const fallback = (reason: 'no-endpoint' | 'failed'): Status => {
    const href = mailtoUrl(`Enquiry: ${serviceLabel(values.service)}`, summary(values));
    return href ? { kind: 'mailto', href, reason } : { kind: 'no-channel', reason };
  };

  async function onSubmit(ev: SubmitEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (status.kind === 'sending') return;

    const errs = validate(values);
    setErrors(errs);
    setTouched({ name: true, phone: true, service: true, message: true });
    const first = (Object.keys(refs) as Field[]).find((f) => errs[f]);
    if (first) {
      refs[first].current?.focus();
      return;
    }

    // Honeypot: bots fill hidden fields. Pretend success and send nothing.
    if (values.company) {
      setStatus(sentStatus(values.service));
      return;
    }

    if (!endpoint) {
      const s = fallback('no-endpoint');
      setStatus(s);
      if (s.kind === 'mailto') window.location.href = s.href;
      return;
    }

    setStatus({ kind: 'sending' });
    try {
      const mobile = normaliseIndianMobile(values.phone);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          phone: mobile ? `+91${mobile}` : values.phone.trim(),
          service: serviceLabel(values.service),
          message: values.message.trim(),
          language: values.language || undefined,
          _subject: `Website enquiry: ${serviceLabel(values.service)}`,
          page: window.location.pathname,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus(sentStatus(values.service));
      setValues({ name: '', phone: '', service: '', message: '', language: '', company: '' });
      setTouched({});
      setErrors({});
    } catch {
      setStatus(fallback('failed'));
    }
  }

  const wa = whatsappUrl(`Hello ${site.owner.name}, I'd like help with ${serviceLabel(values.service) || 'tax filing'}.`);
  const tel = telUrl();
  const describedBy = (f: Field, hint?: boolean) =>
    [hint ? id(`${f}-hint`) : null, errors[f] ? id(`${f}-error`) : null].filter(Boolean).join(' ') || undefined;
  const fieldClass = (f: Field) => `field${errors[f] ? ' field--error' : ''}`;

  const altChannels = (
    <>
      {wa && (
        <a href={wa} target="_blank" rel="noopener">
          WhatsApp
        </a>
      )}
      {wa && tel && ' or '}
      {tel && <a href={tel}>call {formatPhone(site.contact.phone)}</a>}
    </>
  );

  const sent = status.kind === 'sent';

  return (
    <div className="contact-form">
      {sent && (
        <div
          ref={receivedRef}
          className="cf-received fade-in"
          tabIndex={-1}
          role="group"
          aria-labelledby={id('received-title')}
        >
          <span className="stamp cf-stamp" aria-hidden="true">
            Received
          </span>
          <p className="cf-received-meta" aria-hidden="true">
            Enquiry slip · {status.at}
          </p>
          <h3 id={id('received-title')} className="cf-received-title">
            Thank you, your enquiry has been sent.
          </h3>
          <p className="cf-received-text">
            You’ll get a reply by phone or WhatsApp
            {site.contact.hoursLabel ? ` during working hours (${site.contact.hoursLabel})` : ' as soon as possible'}.
          </p>
          <dl className="cf-receipt">
            <div>
              <dt>Service</dt>
              <dd>{status.service}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{status.at}</dd>
            </div>
          </dl>
          <button type="button" className="btn btn--ghost" onClick={() => setStatus({ kind: 'idle' })}>
            <RotateCcw aria-hidden="true" /> Send another enquiry
          </button>
        </div>
      )}

      <form className="cf-form" noValidate onSubmit={onSubmit} aria-describedby={id('privacy')} hidden={sent}>
        <div className="cf-grid">
          <div className={fieldClass('name')}>
            <label htmlFor={id('name')}>Your name</label>
            <input
              ref={refs.name}
              id={id('name')}
              name="name"
              className="input"
              autoComplete="name"
              required
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              onBlur={() => blur('name')}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={describedBy('name')}
            />
            {errors.name && <p id={id('name-error')} className="error-text">{errors.name}</p>}
          </div>

          <div className={fieldClass('phone')}>
            <label htmlFor={id('phone')}>Mobile number</label>
            <input
              ref={refs.phone}
              id={id('phone')}
              name="phone"
              type="tel"
              inputMode="tel"
              className="input tabular"
              autoComplete="tel-national"
              placeholder="98765 43210"
              required
              value={values.phone}
              onChange={(e) => set('phone', e.target.value)}
              onBlur={() => blur('phone')}
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={describedBy('phone', true)}
            />
            <p id={id('phone-hint')} className="hint">Indian mobile number, so you can be called or messaged back.</p>
            {errors.phone && <p id={id('phone-error')} className="error-text">{errors.phone}</p>}
          </div>

          <div className={fieldClass('service')}>
            <label htmlFor={id('service')}>What do you need help with?</label>
            <select
              ref={refs.service}
              id={id('service')}
              name="service"
              className="select"
              required
              value={values.service}
              onChange={(e) => set('service', e.target.value)}
              onBlur={() => blur('service')}
              aria-invalid={errors.service ? true : undefined}
              aria-describedby={describedBy('service')}
            >
              <option value="" disabled>
                Choose a service
              </option>
              {services.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            {errors.service && <p id={id('service-error')} className="error-text">{errors.service}</p>}
          </div>

          <div className="field">
            <label htmlFor={id('language')}>
              Preferred language <span className="optional">(optional)</span>
            </label>
            <select
              id={id('language')}
              name="language"
              className="select"
              value={values.language}
              onChange={(e) => set('language', e.target.value)}
            >
              <option value="">No preference</option>
              {languages.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div className={`${fieldClass('message')} cf-full`}>
            <label htmlFor={id('message')}>Message</label>
            <textarea
              ref={refs.message}
              id={id('message')}
              name="message"
              className="textarea"
              rows={5}
              maxLength={2000}
              required
              value={values.message}
              onChange={(e) => set('message', e.target.value)}
              onBlur={() => blur('message')}
              aria-invalid={errors.message ? true : undefined}
              aria-describedby={describedBy('message', true)}
            />
            <p id={id('message-hint')} className="hint">
              A line or two is enough, for example “Salaried, two Form 16s this year, need ITR filed.”
            </p>
            {errors.message && <p id={id('message-error')} className="error-text">{errors.message}</p>}
          </div>

          {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
          <div className="cf-hp" aria-hidden="true">
            <label htmlFor={id('hp')}>Leave this field empty</label>
            <input
              id={id('hp')}
              name="hp_check"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={values.company}
              onChange={(e) => set('company', e.target.value)}
            />
          </div>
        </div>

        <p id={id('privacy')} className="notice cf-note">
          <TriangleAlert aria-hidden="true" />
          <span>
            Please don’t send PAN, Aadhaar or other documents through this form. Your details are used only to reply to you. See the{' '}
            <a href="/privacy">privacy notice</a>.
          </span>
        </p>

        <div className="cf-actions">
          <p className="cf-sign" aria-hidden="true">
            For office use · Reply by phone or WhatsApp
          </p>
          <button
            type="submit"
            className="btn btn--primary btn--lg"
            disabled={status.kind === 'sending'}
            aria-disabled={status.kind === 'sending'}
          >
            <Send aria-hidden="true" /> {status.kind === 'sending' ? 'Sending…' : 'Send enquiry'}
          </button>
        </div>
      </form>

      <div className="cf-status" aria-live="polite" role="status">
        {status.kind === 'sending' && <p className="visually-hidden">Sending your enquiry…</p>}
        {sent && <p className="visually-hidden">Enquiry received. Thank you.</p>}
        {status.kind === 'mailto' && (
          <p className="notice cf-msg fade-in">
            <TriangleAlert aria-hidden="true" />
            <span>
              {status.reason === 'failed' ? 'The form could not be sent just now. ' : ''}
              Your email app should open with your message filled in. If it didn’t,{' '}
              <a href={status.href}>open the email</a>
              {wa || tel ? <>, or {altChannels}</> : null}.
            </span>
          </p>
        )}
        {status.kind === 'no-channel' && (
          <p className="notice cf-msg fade-in">
            <TriangleAlert aria-hidden="true" />
            <span>
              {status.reason === 'failed'
                ? 'Sorry, the form could not be sent just now. '
                : 'The online form isn’t connected yet. '}
              {wa || tel ? <>Please {altChannels} instead.</> : <>Please use the WhatsApp or call buttons on this page instead.</>}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
