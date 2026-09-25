import { enabledServices, type ServiceSlug } from './site';

/** Short labels used in nav, footer, contact form and cards. Full page content lives in src/content/services. */
export const serviceMeta: Record<ServiceSlug, { title: string; short: string; whatsappTopic: string }> = {
  'income-tax-return-filing': {
    title: 'Income Tax Return (ITR) filing',
    short: 'ITR filing for salaried people, pensioners, freelancers and small businesses.',
    whatsappTopic: 'income tax return (ITR) filing',
  },
  'gst-registration-and-returns': {
    title: 'GST registration & returns',
    short: 'New GST registration and monthly or quarterly GSTR-1 / GSTR-3B filing.',
    whatsappTopic: 'GST registration / returns',
  },
  tds: {
    title: 'TDS returns & payments',
    short: 'TDS deduction, challan payment and quarterly TDS return filing.',
    whatsappTopic: 'TDS returns / payments',
  },
  'challan-payments': {
    title: 'Challan payments',
    short: 'Help paying income tax and GST challans, and vehicle e-challans on official portals.',
    whatsappTopic: 'a challan payment',
  },
  'pan-and-aadhaar': {
    title: 'PAN & Aadhaar help',
    short: 'New PAN, corrections, e-PAN and PAN-Aadhaar linking, on official portals.',
    whatsappTopic: 'PAN / Aadhaar',
  },
  'tax-notices-and-refunds': {
    title: 'Income tax notices & refunds',
    short: 'Understanding and replying to notices, rectifications, and chasing stuck refunds.',
    whatsappTopic: 'an income tax notice / refund',
  },
  'business-registrations': {
    title: 'Business registrations',
    short: 'Udyam (MSME), TAN and GST registration for new and small businesses.',
    whatsappTopic: 'a business registration (Udyam / TAN / GST)',
  },
  financing: {
    title: 'Financing help',
    short: 'TODO(owner): confirm what this service covers.',
    whatsappTopic: 'financing',
  },
};

export const serviceNav = enabledServices.map((slug) => ({
  slug,
  href: `/services/${slug}`,
  ...serviceMeta[slug],
}));

export const toolNav = [
  { href: '/tools/income-tax-calculator', title: 'Income tax calculator', short: 'Old vs new regime, with a full breakdown.' },
  { href: '/tools/hra-calculator', title: 'HRA exemption calculator', short: 'Work out the exempt part of your HRA (old regime).' },
  { href: '/tools/gst-calculator', title: 'GST calculator', short: 'Add or remove GST and split CGST/SGST or IGST.' },
  { href: '/tools/advance-tax', title: 'Advance tax planner', short: 'Instalment due dates and a 234B/234C interest estimate.' },
  { href: '/tools/tds-calculator', title: 'TDS rate finder', short: 'Look up common TDS rates and thresholds.' },
] as const;

export const mainNav = [
  { href: '/services', label: 'Services' },
  { href: '/tools', label: 'Calculators' },
  { href: '/faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;
