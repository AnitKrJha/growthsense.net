/**
 * Home-page copy, kept as data so the design phase can restyle freely without rewriting text.
 * Rules: neutral wording ("tax filing assistance", "tax practitioner"); no stats, testimonials,
 * credentials or prices; copy must read fine when site.location.city is null.
 * Owner to confirm all of it.
 */
import { site } from '@/config/site';

const city = site.location.city;
const owner = site.owner.name;

export const hero = {
  eyebrow: city ? `Tax filing assistance in ${city}` : 'Tax filing assistance',
  /** First entry is used; the rest are alternatives for the designer / owner to choose from. */
  headlines: [
    'Income tax, GST and TDS filing, done right and on time.',
    'Your tax filing, handled carefully and explained clearly.',
    'ITR, GST and TDS filing without the last-minute stress.',
    'Tax filing help you can actually understand.',
  ],
  lead: `Hand the paperwork to ${owner}. You get a clear document checklist, a quote upfront, and a plain-language summary to approve before anything is filed on the official portal.`,
  points: ['Quote before work starts', 'You approve before filing', 'Official portals only'],
};

/**
 * Illustrative regime comparison for a hero visual. FY 2025-26 slabs (VERIFY if slabs change):
 * salary ₹15,00,000. Old regime: std deduction ₹50,000 + 80C ₹1,50,000 + 80D ₹25,000 → taxable ₹12,75,000
 * → ₹1,95,000 + 4% cess = ₹2,02,800. New regime: std deduction ₹75,000 → taxable ₹14,25,000
 * → ₹93,750 + 4% cess = ₹97,500. Always label as an example, not advice.
 */
export const heroExample = {
  title: 'Old vs new regime',
  year: 'FY 2025-26',
  caption: 'Illustrative: salary ₹15,00,000, with ₹1,75,000 of 80C and 80D deductions',
  rows: [
    { label: 'Old regime', amount: 202800 },
    { label: 'New regime', amount: 97500 },
  ],
  footnote: 'Example only, not advice. Try the income tax calculator with your own numbers.',
};

export const servicesIntro = {
  eyebrow: 'Services',
  title: 'What you can get help with',
  text: `Individuals, freelancers and small businesses${city ? ` in and around ${city}` : ''}. Pricing is on request for every service.`,
  unsure: {
    title: 'Not sure what you need?',
    text: 'Describe your situation and you will be pointed in the right direction.',
    cta: 'Ask a question',
  },
};

export const howItWorks = {
  eyebrow: 'How it works',
  title: 'Four simple steps, no surprises',
  text: 'The same routine for every service, so you always know what happens next.',
  steps: [
    { title: 'Message or call', text: 'Say what you need on WhatsApp, by phone or through the contact form.' },
    { title: 'Checklist and quote', text: 'Get a document checklist that fits your case and a clear quote before any work starts.' },
    { title: 'Review the summary', text: 'Your return or statement is prepared and explained in plain language for you to approve.' },
    { title: 'Filed and confirmed', text: 'It is filed on the official portal and you receive the acknowledgement for your records.' },
  ],
};

export const toolsIntro = {
  eyebrow: 'Free calculators',
  title: 'Check the numbers yourself first',
  text: 'Quick estimates that run in your browser. Nothing you type is stored or sent anywhere.',
  note: 'Estimates for information only, not tax advice.',
};

/** Honest, non-numeric reasons. Icons are lucide-react names, mapped in the page. */
export const whyUs = {
  eyebrow: `Why ${site.brandName}`,
  title: 'Careful work, explained clearly',
  text: 'Tax filing goes best when you understand what is being filed in your name. That is how every piece of work is done here.',
  points: [
    { icon: 'UserRound', title: 'One person, start to finish', text: `You deal directly with ${owner}. The person you speak to is the person doing the work.` },
    { icon: 'ClipboardList', title: 'A checklist before anything else', text: 'You know exactly which documents are needed, so there is no back and forth later.' },
    { icon: 'MessageCircle', title: 'Quote agreed upfront', text: 'Pricing is on request and agreed before work starts. No surprises at the end.' },
    { icon: 'FileCheck', title: 'You approve before filing', text: 'Nothing is filed until you have seen a clear summary and said yes.' },
    { icon: 'Landmark', title: 'Official portals only', text: 'Returns and challans go through government portals. Tax is paid by you, directly to the government.' },
    { icon: 'BellRing', title: 'Reminders before due dates', text: 'For regular GST and TDS work, you get a nudge before each deadline.' },
  ],
} as const;

export const faqTeaser = {
  eyebrow: 'FAQ',
  title: 'Common questions',
  text: 'Quick answers about getting started, pricing and documents.',
  count: 5,
};

export const closingCta = {
  title: 'Ready when you are',
  text: 'Send a message on WhatsApp or call. You will get a clear list of what is needed and a quote before any work starts.',
};

export const homeMeta = {
  description: `Tax filing assistance${city ? ` in ${city}` : ''} from ${owner}: ITR filing, GST registration and returns, TDS and challan payments. Clear checklist, quote upfront, filed on official portals.`,
};
