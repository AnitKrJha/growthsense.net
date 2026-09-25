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
    /** Neutral wording until credentials are confirmed. Never "CA", "GSTP", "ERI", "consultant firm". */
    role: 'Tax filing assistance',
    /** TODO(owner): exact credentials, e.g. GST Practitioner enrolment no. Leave empty if none. */
    credentials: [] as string[],
    /** TODO(owner): years of experience. */
    yearsOfExperience: null as number | null,
    /** TODO(owner): short bio for /about. */
    bio: null as string | null,
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
    /** TODO(owner): E.164 without "+", e.g. "919876543210". */
    phone: null as string | null,
    /** TODO(owner): WhatsApp number, E.164 without "+". Often same as phone. */
    whatsapp: null as string | null,
    /** TODO(owner) */
    email: null as string | null,
    /** TODO(owner): e.g. "Mon–Sat, 10:00 am – 7:00 pm". */
    hoursLabel: null as string | null,
    /** schema.org openingHours, e.g. ["Mo-Sa 10:00-19:00"]. TODO(owner) */
    openingHours: [] as string[],
  },

  location: {
    /** TODO(owner): city / areas served. */
    city: null as string | null,
    state: null as string | null,
    areasServed: [] as string[],
    /** Only fill if the owner wants a public address. */
    streetAddress: null as string | null,
    postalCode: null as string | null,
    mode: 'TODO: in person, online, or both' as string,
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

  credit: { label: 'Anit', url: 'https://anit.dev' },
} as const;

export const isTodo = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && (v.trim() === '' || v.includes('TODO'))) ||
  (Array.isArray(v) && v.length === 0);

export const enabledServices = (Object.keys(site.services) as ServiceSlug[]).filter((s) => site.services[s]);
