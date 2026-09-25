# GrowthSense

Website for **GrowthSense**, the tax filing assistance service run by **Avinash Thakur**, an individual tax practitioner in India. The site exists to get visitors to call, WhatsApp or send an enquiry. It covers ITR filing, GST registration and returns, TDS, and challan payments, and it includes free calculators (income tax old vs new regime, HRA, GST, advance tax and TDS rates).

## Stack

- [Astro 7](https://astro.build) + TypeScript, static output (prerendered HTML for every page)
- React islands only where interactivity is needed (calculators, contact form)
- Astro content collections (`glob` loader + zod) for service pages
- Plain CSS with design tokens (`src/styles/global.css`), self-hosted fonts via `@fontsource-variable`
- `lucide-react` icons, `react-icons` for the WhatsApp logo
- `@astrojs/sitemap` for `sitemap-index.xml`
- Vitest for the tax engines in `src/lib/**`
- Deployed as a static site on Vercel

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Install dependencies (see the install note below) |
| `pnpm dev` | Start the dev server at http://localhost:4321 |
| `pnpm check` | Type-check Astro, TS and content schemas (`astro check`) |
| `pnpm build` | `astro check` + production build into `dist/` |
| `pnpm preview` | Serve the production build locally |
| `pnpm test` | Run the Vitest suite once (`pnpm test:watch` to watch) |

### Install note

The project `.npmrc` points to the public npm registry (`registry.npmjs.org`), which is what Vercel uses. Inside the sandbox, where the public registry is blocked, install with:

```sh
pnpm install --registry=https://npm.apple.com
```

Never commit an `.npmrc` that points to an internal registry. The pnpm lockfile doesn't embed registry URLs, so it deploys fine either way.

## Where to edit things

| What | Where |
| --- | --- |
| Owner facts: name, role, credentials, bio, phone, WhatsApp, email, hours, city, areas served, which services are live, pricing wording, languages | `src/config/site.ts` (single source of truth; anything `null` shows a visible **TODO** badge on the site) |
| Nav labels, short service blurbs, WhatsApp message topics, calculator list | `src/config/nav.ts` |
| Service pages (who it's for, what's included, document checklist, process, timeline, FAQs, official links) | `src/content/services/*.md` (file name = URL slug; schema in `src/content.config.ts`) |
| General FAQs (`/faq` and the home teaser) | `src/content/faqs.ts` |
| Home-page copy (hero headline options, steps, "why" points) | `src/content/home.ts` |
| About, contact, privacy, disclaimer pages | `src/pages/*.astro` |
| Logo, favicon, OG image | `public/brand/`, `public/favicon.svg`, `public/og-default.png` |
| Owner photo | Add the image under `public/brand/` and set `owner.photo` (and optionally `owner.photoAlt`) in `site.ts`. The About page picks it up automatically. |

To hide or show a service, toggle it in `site.services` in `site.ts`. A service is only built if it is enabled **and** its Markdown file has `draft: false`. **Financing** is currently disabled and its content is a draft, because it isn't confirmed what the service means.

## Environment variables

Copy `.env.example` to `.env` for local use and set the same variables in Vercel. `PUBLIC_*` variables are baked in at build time, so rebuild after changing them.

| Variable | Purpose |
| --- | --- |
| `PUBLIC_SITE_URL` | Absolute site URL, no trailing slash. Used for canonical URLs, `og:image` and the sitemap. |
| `PUBLIC_FORM_ENDPOINT` | Formspree-style endpoint for the contact form (receives JSON). If it's unset or the request fails, the form falls back to a pre-filled `mailto:` using the email in `site.ts`. If there is no email either, it points visitors to WhatsApp or phone. |

## Contact form

`src/components/ContactForm.tsx` is a React island on `/contact`. It:

- collects name, Indian mobile number (validated), service, message and an optional preferred language
- preselects the service from `?service=<slug>`, which the service pages link to
- uses a hidden honeypot field: if a bot fills it, the form pretends to succeed and sends nothing
- POSTs JSON with `Accept: application/json` to `PUBLIC_FORM_ENDPOINT`
- announces success and error states in an `aria-live` region, and does inline validation with `aria-invalid` / `aria-describedby`
- tells visitors not to send PAN, Aadhaar or documents through the form

## Deploy on Vercel

1. Push the repo to GitHub and import it in Vercel. The framework preset is **Astro**, the build command is `pnpm build` and the output directory is `dist`.
2. Set `PUBLIC_SITE_URL` and `PUBLIC_FORM_ENDPOINT` under Project → Settings → Environment Variables.
3. Add the custom domain in Vercel, then update the domain in the places listed below and redeploy.

## Before launch checklist

- [ ] `grep -rn "TODO" src public astro.config.mjs` returns nothing that should be public. Also check the built site for visible **TODO** badges.
- [ ] Fill in `src/config/site.ts`: phone, WhatsApp, email, hours, `openingHours`, city / state / areas served, mode (in person / online / both), bio, credentials, years of experience, languages.
- [ ] The owner has confirmed every service page in `src/content/services/`: scope, checklists, timelines and FAQs. Decide on financing: enable it with confirmed copy, or delete it.
- [ ] **Verify the tax rules** used by the calculators and in the copy (slabs, 87A rebate, standard deduction, surcharge, cess, GST rates, TDS sections, due dates). Check them against incometax.gov.in, the Finance Act, CBDT and CBIC, including Finance Act 2026 / Income-tax Act, 2025 changes. Update the "rules last verified" notes. The illustrative figures on the home page are in `src/content/home.ts`.
- [ ] Check that every official portal link in the service files still works.
- [ ] Set the real domain in `PUBLIC_SITE_URL` (it's read by `astro.config.mjs`) and in `public/robots.txt` (the `Sitemap:` line).
- [ ] Create a form provider account (for example Formspree), set `PUBLIC_FORM_ENDPOINT`, send a test enquiry, and name the provider in `/privacy`.
- [ ] Review `/privacy` and `/disclaimer`: retention period, privacy contact email, credentials paragraph. Ideally get a lawyer to look at them.
- [ ] Set up a **Google Business Profile** with the same name, phone, hours and area as `site.ts`. For local search it matters more than on-page SEO.
- [ ] Replace `public/og-default.png` if needed, and add the owner photo.
- [ ] Run `pnpm build` and `pnpm test`, then check key pages on a phone (`pnpm dev`, or a Vercel preview).
- [ ] Add no testimonials, client counts, logos or credentials unless they are real and confirmed. Testimonials also need the client's written consent.

## Open questions for the owner

1. The name / brand name for the site (currently "GrowthSense"), and the domain.
2. City and areas served. Do you meet clients in person, work online only, or both? Should a public address be shown?
3. Your credentials, stated exactly: CA, tax practitioner, GST Practitioner (GSTP) enrolment, ERI, years of experience. If you have none, the site avoids those titles.
4. Confirm the services: ITR, GST registration and returns, TDS, tax challans, **vehicle challans**, **"financing"** (what exactly?), notices, PAN/Aadhaar help?
5. Who are your clients: salaried people, small businesses, freelancers, NRIs?
6. Pricing: "on request" everywhere, or "starting from ₹…" for some services?
7. Languages: English only, or Hindi (or a regional language) too? If Hindi, `/hi/` routes with `hreflang` should be planned.
8. Contact details: phone, WhatsApp number, email, working hours and your preferred channel.
9. A photo and a short bio for /about. Real testimonials only, with written consent.
10. A form provider account (Formspree or similar) and a Google Business Profile.

---

Website designed with ♥ by [Anit](https://anit.dev).
