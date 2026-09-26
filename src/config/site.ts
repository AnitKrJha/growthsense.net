/**
 * Single source of truth for owner facts.
 *
 * Anything that is still `null` or contains "TODO" is unconfirmed. Pages must render
 * a visible placeholder (see `isTodo` / <Todo />) rather than inventing a value.
 * Do not add credentials, stats, testimonials or prices here unless the owner confirms them.
 */

export type ServiceSlug =
  | 'income-tax-return-filing'
  | 'gst-registration-and-returns'
  | 'tds'
  | 'challan-payments'
  | 'pan-and-aadhaar'
  | 'tax-notices-and-refunds'
  | 'business-registrations'
  | 'financing';

export const site = {
  owner: {
    name: 'Avinash Thakur',
    /** Neutral wording: never "CA", "GSTP", "ERI", "consultant firm" unless a registration is confirmed. */
    role: 'Tax & accounts practitioner',
    /**
     * Formal professional registrations ONLY (e.g. a GST Practitioner enrolment no.). Leave empty if none:
     * /disclaimer relies on this to state what is not claimed. Experience goes in `highlights` instead.
     */
    credentials: [] as string[],
    /** Track record, as provided by the owner. Shown on /about. Keep to facts the owner can stand behind. */
    highlights: [
      '10+ years in accounting and finance',
      'Previously worked with Havas Media, part of the global Havas advertising and communications group',
      '200+ income tax returns filed',
    ] as string[],
    yearsOfExperience: 10 as number | null,
    bio: 'Avinash Thakur has spent more than ten years in accounting and finance, including time with Havas Media, part of the global Havas group. Through GrowthSense he brings that corporate discipline to individuals and small businesses: income tax returns, GST, TDS and the everyday paperwork in between. He has filed more than 200 income tax returns, and he explains every step in plain language before anything is submitted.' as string | null,
    /** Portrait (4:5-ish, 912×1149 source) in /public/owner. `avatar` is a 192px square face crop. */
    photo: {
      src: '/owner/avinash-thakur-480.webp',
      srcset: '/owner/avinash-thakur-480.webp 480w, /owner/avinash-thakur-912.webp 912w',
      fallback: '/owner/avinash-thakur-480.jpg',
      width: 912,
      height: 1149,
      alt: 'Avinash Thakur in a navy suit, standing by an office window overlooking the city',
      avatar: '/owner/avinash-thakur-avatar.webp',
    },
  },

  brandName: 'GrowthSense',
  /** Logo files live in /public/brand. `logo` is for light backgrounds, `white` for dark. Intrinsic size 742×129. */
  logo: { src: '/brand/logo.webp', white: '/brand/logo-white.webp', width: 742, height: 129 },
  tagline: 'Income tax, GST and TDS filing help, done right and on time.',

  contact: {
    /** E.164 without "+". */
    phone: '918585909044' as string | null,
    /** WhatsApp number, E.164 without "+". Same as phone. */
    whatsapp: '918585909044' as string | null,
    /** TODO(owner) */
    email: 'info@growthsense.net' as string | null,
    hoursLabel: 'Every day, 9 am to 9 pm IST' as string | null,
    /** Shown next to the hours where there is room. */
    hoursNote: 'Messages are welcome anytime and answered as soon as possible.' as string | null,
    /** schema.org openingHours. */
    openingHours: ['Mo-Su 09:00-21:00'] as string[],
  },

  location: {
    /** Base location (used in local-search copy such as "ITR filing in Delhi NCR"). */
    city: 'Delhi NCR' as string | null,
    state: 'Delhi' as string | null,
    /** Clients are served across India; "India" is emitted as a Country in JSON-LD. */
    areasServed: ['Delhi NCR', 'India'] as string[],
    /** Only fill if the owner wants a public address. */
    streetAddress: null as string | null,
    postalCode: null as string | null,
    mode: 'Online over phone, WhatsApp and email, or in person in Delhi NCR' as string,
  },

  /** Which services are live. Set to false to hide a page + nav link until confirmed. */
  services: {
    'income-tax-return-filing': true,
    'gst-registration-and-returns': true,
    tds: true,
    'challan-payments': true,
    // TODO(owner): confirm these three common services (added as general Indian tax-practice offerings).
    'pan-and-aadhaar': true,
    'tax-notices-and-refunds': true,
    'business-registrations': true,
    financing: false, // TODO(owner): confirm what "financing" means before enabling.
  } satisfies Record<ServiceSlug, boolean>,

  pricing: 'On request',

  /** TODO(owner): "en" only, or also "hi". If Hindi is wanted, add /hi/ routes with hreflang. */
  languages: ['en'] as const,

  /** Designer credit in the footer. Links to the case study on the designer's site. */
  credit: { label: 'Anit Jha', url: 'https://anit.dev/projects/growthsense', title: 'Anit Jha, designer and developer of this site' },
} as const;

export const isTodo = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && (v.trim() === '' || v.includes('TODO'))) ||
  (Array.isArray(v) && v.length === 0);

export const enabledServices = (Object.keys(site.services) as ServiceSlug[]).filter((s) => site.services[s]);
