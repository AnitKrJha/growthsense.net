/**
 * Every public route that gets its own Open Graph card, with the words printed on it.
 * `slug` maps to the image path: `/og/<slug>.png` (home is "index"). BaseLayout derives the same slug from the
 * page URL, and scripts/check-seo.mjs fails the build if any page points at a card that wasn't generated.
 * Adding a page? Add it here too.
 */
import { getCollection } from 'astro:content';
import { site, type ServiceSlug } from '@/config/site';
import { serviceMeta } from '@/config/nav';
import { codeFor, folio } from '@/components/service-codes';

export type OgVariant = 'home' | 'service' | 'tool' | 'page';

export interface OgRoute {
  slug: string;
  variant: OgVariant;
  /** Small mono line above the title, e.g. "SERVICE · 03 / TDS". */
  kicker: string;
  title: string;
  /** Optional second headline line, printed smaller in mint (home only). */
  titleAccent?: string;
  subtitle: string;
  /** Short code printed on the paper artefact (folder tab, receipt header). */
  code?: string;
  /** Rubber-stamp word on the artefact. Defaults per variant (FILED / ON FILE / ESTIMATE). */
  stamp?: string;
  /** Alt text for og:image:alt / twitter:image:alt. */
  alt: string;
}

const brand = site.brandName;
const where = site.location.city ? `${site.location.city} · All India` : 'All India';

const alt = (title: string) => `${brand}: ${title}. ${site.owner.name}, ${site.owner.role.toLowerCase()}, ${where}.`;

export async function ogRoutes(): Promise<OgRoute[]> {
  const services = (await getCollection('services', ({ id, data }) => !data.draft && site.services[id as ServiceSlug]))
    .sort((a, b) => a.data.order - b.data.order);

  const routes: OgRoute[] = [
    {
      slug: 'index',
      variant: 'home',
      kicker: [site.owner.role, site.location.city].filter(Boolean).join(' · '),
      title: 'Send us the mess.',
      titleAccent: 'Get back an acknowledgement.',
      subtitle: `Income tax, GST, TDS and challans by ${site.owner.name}. Quote upfront, nothing filed without your approval.`,
      alt: alt('Send us the mess, get back an acknowledgement'),
    },
    {
      slug: 'services',
      variant: 'page',
      kicker: `Services · ${services.length} on the desk`,
      title: 'ITR, GST, TDS, challans and the paperwork in between',
      subtitle: 'Each service comes with a document checklist, a clear process and a quote before any work starts.',
      code: 'INDEX',
      stamp: 'ON FILE',
      alt: alt('Services'),
    },
    ...services.map((s, i) => {
      const slug = s.id as ServiceSlug;
      const { code } = codeFor(slug);
      return {
        slug: `services/${slug}`,
        variant: 'service' as const,
        kicker: `Service · ${folio(i + 1)} / ${code}`,
        title: serviceMeta[slug]?.title ?? s.data.title,
        subtitle: s.data.description,
        code,
        alt: alt(serviceMeta[slug]?.title ?? s.data.title),
      };
    }),
    {
      slug: 'tools',
      variant: 'tool',
      kicker: 'Free calculators · FY 2025-26',
      title: 'Tax calculators that show their working',
      subtitle: 'Income tax (old vs new regime), HRA, GST, advance tax and TDS. Quick estimates, no sign-up, nothing stored.',
      code: 'TOOLS',
      alt: alt('Free tax calculators'),
    },
    {
      slug: 'tools/income-tax-calculator',
      variant: 'tool',
      kicker: 'Worksheet 01 · Income tax',
      title: 'Income tax calculator: new vs old regime',
      subtitle: 'Slab-wise tax, 87A rebate, surcharge, cess and capital gains, compared side by side.',
      code: 'ITR',
      alt: alt('Income tax calculator, new vs old regime'),
    },
    {
      slug: 'tools/hra-calculator',
      variant: 'tool',
      kicker: 'Worksheet 02 · HRA',
      title: 'HRA exemption calculator',
      subtitle: 'All three HRA limits, and which one applies to you (old regime).',
      code: 'HRA',
      alt: alt('HRA exemption calculator'),
    },
    {
      slug: 'tools/gst-calculator',
      variant: 'tool',
      kicker: 'Worksheet 03 · GST',
      title: 'GST calculator: add or remove GST',
      subtitle: 'CGST + SGST or IGST split to the paisa, at 5%, 18%, 40% and special rates.',
      code: 'GST',
      alt: alt('GST calculator'),
    },
    {
      slug: 'tools/advance-tax',
      variant: 'tool',
      kicker: 'Worksheet 04 · Advance tax',
      title: 'Advance tax planner',
      subtitle: 'Instalments for 15 June, September, December and March, with a 234B / 234C interest estimate.',
      code: 'ADV',
      alt: alt('Advance tax planner'),
    },
    {
      slug: 'tools/tds-calculator',
      variant: 'tool',
      kicker: 'Worksheet 05 · TDS',
      title: 'TDS rate finder',
      subtitle: 'Sections, thresholds and rates for FY 2025-26, and the TDS on any payment.',
      code: 'TDS',
      alt: alt('TDS rate finder'),
    },
    {
      slug: 'about',
      variant: 'page',
      kicker: 'Personal file · About',
      title: `Meet ${site.owner.name}`,
      subtitle: site.owner.highlights.slice(0, 2).join('. ') + '.',
      code: 'ABOUT',
      stamp: 'ON FILE',
      alt: alt(`About ${site.owner.name}`),
    },
    {
      slug: 'faq',
      variant: 'page',
      kicker: 'Questions · Answered plainly',
      title: 'Frequently asked questions',
      subtitle: 'Getting started, pricing, sharing documents safely, refunds, notices and the calculators.',
      code: 'FAQ',
      stamp: 'ANSWERED',
      alt: alt('Frequently asked questions'),
    },
    {
      slug: 'contact',
      variant: 'page',
      kicker: 'Enquiry slip · Reply same day',
      title: 'WhatsApp, call or send an enquiry',
      subtitle: `${site.contact.hoursLabel ?? 'Messages welcome anytime'}. Describe what you need and get a checklist and a quote.`,
      code: 'CONTACT',
      stamp: 'RECEIVED',
      alt: alt('Contact'),
    },
    {
      slug: 'privacy',
      variant: 'page',
      kicker: 'Notice · DPDP Act, 2023',
      title: 'Privacy notice',
      subtitle: 'What this website collects, where it goes, and your rights. Nothing is ever sold.',
      code: 'PRV',
      stamp: 'NOTICE',
      alt: alt('Privacy notice'),
    },
    {
      slug: 'disclaimer',
      variant: 'page',
      kicker: 'Notice · Read before relying on figures',
      title: 'Disclaimer',
      subtitle: 'Calculators give estimates for information only. Not tax, legal or financial advice.',
      code: 'DSC',
      stamp: 'NOTICE',
      alt: alt('Disclaimer'),
    },
  ];
  return routes;
}

/** The card slug for a page URL: "/" → "index", "/services/tds/" → "services/tds". */
export function ogSlugForPath(pathname: string): string {
  const clean = pathname.replace(/\/+$/, '').replace(/^\/+/, '').replace(/\.html$/, '');
  return clean === '' ? 'index' : clean;
}
