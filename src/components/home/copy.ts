/**
 * Copy for the home-page narrative sections (everything below the hero).
 * Reuses owner-confirmable text from src/content/home.ts wherever it exists; the new lines here are
 * headings and paper-artefact labels written for the "Paperwork → Filed" concept.
 * Rules: no em dashes, no stats, no prices, no invented facts. Owner to confirm.
 */
import { site } from '@/config/site';
import type { ServiceSlug } from '@/config/site';
import { closingCta, faqTeaser, howItWorks, servicesIntro, toolsIntro, whyUs } from '@/content/home';

const owner = site.owner.name;
const firstName = owner.split(' ')[0];

export const foldersCopy = {
  title: 'Which folder is yours?',
  lead: `Open one to see what it covers and the papers to keep ready. ${servicesIntro.text}`,
  unsure: servicesIntro.unsure,
  /** Label printed on the drawer's front lip (paper artefact). */
  drawerLabel: 'Client files',
  keepReady: 'Keep these ready',
  more: 'See full checklist',
};

/** Tab labels on the manila folders. Paper artefacts, so they are short and set in Martian Mono. */
export const folderTabs: Partial<Record<ServiceSlug, string>> = {
  'income-tax-return-filing': 'ITR',
  'gst-registration-and-returns': 'GST',
  tds: 'TDS',
  'challan-payments': 'Challans',
  'pan-and-aadhaar': 'PAN',
  'tax-notices-and-refunds': 'Notices',
  'business-registrations': 'Udyam',
  financing: 'Loans',
};

export const receiptCopy = {
  title: 'The whole process fits on one slip.',
  lead: howItWorks.text,
  header: 'GrowthSense · Filing slip',
  attendedBy: `Attended by: ${owner}`,
  columns: { item: 'Item', by: 'By' },
  /** Receipt lines (mono) paired with the plain-language explanation (Hanken) from home.ts. */
  items: [
    { label: 'Message on WhatsApp', by: 'You', note: howItWorks.steps[0].text },
    { label: 'Share documents (checklist provided)', by: 'You', note: howItWorks.steps[1].text },
    { label: 'I prepare, you review and approve', by: 'Both', note: howItWorks.steps[2].text },
    { label: 'Filed, you get the acknowledgement', by: firstName, note: howItWorks.steps[3].text },
  ],
  totals: [
    { label: 'Surprise fees', value: 'Nil' },
    { label: 'Total stress', value: '₹0' },
  ],
  footer: 'Nothing is filed without your OK',
  stamp: 'Filed',
  cta: 'Start with step one',
  ctaTopic: undefined as string | undefined,
};

export const deskCopy = {
  title: 'Watch your salary climb the slabs.',
  lead: `Drag to your annual salary. Each step is a new-regime slab and its height is the rate. ${toolsIntro.text}`,
  otherTools: 'More free calculators',
  note: toolsIntro.note,
};

export const honestCopy = {
  title: 'The honest bit.',
  lead: 'Some requests get a polite no, every time. It keeps your filing clean and the advice worth trusting.',
  notTitle: 'Things I won’t do',
  stamp: 'Not included',
  never: [
    'Promise a refund, or say how big it will be',
    'Settle or reduce a traffic fine',
    'Guarantee that a loan gets approved',
    'Write, buy or swap fake reviews',
    'Ask for your Aadhaar or PAN through the website form',
  ],
  getTitle: 'What you do get',
  /** Kept exactly as written in home.ts (owner to confirm). */
  get: whyUs.points.filter((p) =>
    ['One person, start to finish', 'Quote agreed upfront', 'You approve before filing', 'Reminders before due dates'].includes(p.title),
  ),
  about: `More about ${owner}`,
};

export const faqCopy = {
  title: 'Asked before the first message.',
  lead: faqTeaser.text,
  all: 'All questions',
  ask: 'Ask yours on WhatsApp',
};

export const chatCopy = {
  title: 'Start with a hello.',
  lead: closingCta.text,
  wa: 'Message on WhatsApp',
  call: 'Call',
  enquiry: 'Send an enquiry',
  caption: 'An illustration of how a typical ITR request goes. Not a real conversation.',
  ownerName: owner,
  ownerRole: site.owner.role,
};
