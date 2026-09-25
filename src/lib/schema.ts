import { site } from '@/config/site';

type Json = Record<string, unknown>;

const abs = (siteUrl: URL, path: string) => new URL(path, siteUrl).toString();

/** ProfessionalService for an individual, with the owner as a Person. No ratings/reviews. */
export function professionalServiceLd(siteUrl: URL): Json {
  const { contact, location, owner } = site;
  const ld: Json = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': abs(siteUrl, '/#service'),
    name: site.brandName,
    description: site.tagline,
    url: abs(siteUrl, '/'),
    logo: abs(siteUrl, '/icon-512.png'),
    image: abs(siteUrl, '/og/index.png'),
    founder: {
      '@type': 'Person',
      name: owner.name,
      jobTitle: owner.role,
      ...(owner.photo ? { image: abs(siteUrl, owner.photo.fallback) } : {}),
    },
    priceRange: 'On request',
  };
  if (contact.phone) ld.telephone = `+${contact.phone}`;
  if (contact.email) ld.email = contact.email;
  if (contact.openingHours.length) ld.openingHours = contact.openingHours;
  const areas = [...location.areasServed, ...(location.city ? [location.city] : [])];
  if (areas.length)
    ld.areaServed = [...new Set(areas)].map((name) =>
      name === 'India' ? { '@type': 'Country', name } : { '@type': 'Place', name },
    );
  if (location.streetAddress) {
    ld.address = {
      '@type': 'PostalAddress',
      streetAddress: location.streetAddress,
      addressLocality: location.city ?? undefined,
      addressRegion: location.state ?? undefined,
      postalCode: location.postalCode ?? undefined,
      addressCountry: 'IN',
    };
  }
  return ld;
}

export function breadcrumbLd(siteUrl: URL, items: { name: string; path: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: abs(siteUrl, it.path),
    })),
  };
}

export function faqLd(faqs: { question: string; answer: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export function webAppLd(siteUrl: URL, opts: { name: string; path: string; description: string }): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: opts.name,
    url: abs(siteUrl, opts.path),
    description: opts.description,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
  };
}

export function serviceLd(siteUrl: URL, opts: { name: string; path: string; description: string }): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    description: opts.description,
    url: abs(siteUrl, opts.path),
    provider: { '@id': abs(siteUrl, '/#service') },
    areaServed: site.location.city ?? 'IN',
  };
}
