# Design: GrowthSense, "Paperwork → Filed"

Read PRODUCT.md first. This file is the art direction and the shared visual system. All tokens below exist in code in `src/styles/tokens.css`. Use the variables and never hard-code colours.

## 1. The concept

**Papers in, acknowledgement out.** The visitor arrives carrying a mess: Form 16, AIS, invoices, challans, notices. The site visibly takes that mess and puts it in order. Every signature moment is a physical-paper metaphor, carried out with real craft:

| Moment | Metaphor | Where |
|---|---|---|
| Hero | Tax papers drifting in 3D over a dark forest-green desk. They settle into a neat stack and get stamped **FILED** as you scroll. | Home only |
| Deadline strip | A split-flap departure board: "NEXT DEADLINE · GSTR-3B · 20 OCT · 24 DAYS" | Home (and a compact version in the footer) |
| Services | Four file trays or folders with tabs (ITR / GST / TDS / Challans). Hovering or focusing pulls a folder forward to reveal its document checklist. | Home, /services |
| How it works | A thermal receipt that prints line by line as it scrolls into view | Home |
| Calculators | Worksheets: ruled paper, pencil-grey labels. The result prints as a torn receipt / acknowledgement slip. | /tools/* |
| Honesty | A rubber-stamped "NOT INCLUDED" list (no refund guarantees, no fine "settlements", no fake reviews) | Home |
| Final CTA | A WhatsApp conversation that types itself out, ending on a big WhatsApp button | Home |

**Balance rule (from the user):** this is still an official practitioner's site. Spectacle lives on the home page and in small delights such as stamps, receipts and the flap board. Inner pages (services, FAQ, about, contact, legal) are composed and legible, and they use the motif through structure (paper sheets, file tabs, checklists) rather than motion. **CTAs are always obvious:** WhatsApp and Call are never hidden behind an animation, never below a pinned scroll section without a visible alternative, and never low-contrast.

## 2. Theme and colour

Scene: evening, a phone, a WhatsApp-forwarded link, mild anxiety. The page reads as a **warm paper surface** (light theme) with **drenched forest-green "desk" sections** for the hero, the calculators teaser and the footer. The strategy is Committed: forest green carries about 35–45% of the home page.

Colours are OKLCH. The hue family is green (~160); the paper neutrals are tinted warm (~85).

| Token | Value | Role |
|---|---|---|
| `--forest-950` | oklch(0.19 0.035 162) | darkest desk, footer |
| `--forest-900` | oklch(0.24 0.045 162) | hero desk |
| `--forest-800` | oklch(0.31 0.06 160) | raised desk surfaces |
| `--forest-700` | oklch(0.40 0.08 158) | brand green (logo mark), primary buttons on paper |
| `--forest-600` | oklch(0.48 0.09 158) | hover, links on paper |
| `--mint-300` | oklch(0.86 0.09 158) | highlight text/lines on the desk |
| `--mint-100` | oklch(0.95 0.035 158) | tinted paper, selected states |
| `--paper-50` | oklch(0.985 0.008 85) | sheet white (never #fff) |
| `--paper-100` | oklch(0.965 0.014 85) | page background |
| `--paper-200` | oklch(0.93 0.02 85) | alternate band, ruled lines |
| `--paper-300` | oklch(0.87 0.022 85) | borders on paper |
| `--graphite-900` | oklch(0.22 0.015 160) | body ink |
| `--graphite-700` | oklch(0.38 0.015 160) | secondary ink |
| `--graphite-500` | oklch(0.50 0.012 160) | pencil labels (AA on paper-100 at 16px+) |
| `--stamp-600` | oklch(0.55 0.19 29) | rubber-stamp vermilion: stamps, urgency, the "days left" digit. Graphic or large text only. |
| `--stamp-700` | oklch(0.48 0.17 29) | stamp colour for small text (AA) |
| `--carbon-600` | oklch(0.47 0.12 268) | carbon-copy blue-violet. Very rare: acknowledgement numbers, the "duplicate" receipt copy. |
| `--whatsapp` | oklch(0.52 0.13 150) | WhatsApp buttons (white text passes AA) |

Rules:
- Stamp red is the only warm accent. Use it for at most 3–4 moments per page.
- Never use gradient text, glass cards or side-stripe borders.

## 3. Typography

Brand-voice words: **calm, sharp, human**. The physical object is a crisp acknowledgement slip from a well-run office, filled in by a friendly clerk.

- **Display: Bricolage Grotesque Variable** (`--font-display`). It has wdth, opsz and wght axes. Headlines are large and tight (-0.03em), weight 650–750. Use the `wdth` axis for expression: condensed (≈80) for stacked hero lines, normal elsewhere. Numerals in results are display.
- **Text: Hanken Grotesk Variable** (`--font-text`). Body 17px/1.6 on paper, 1.7 on the desk. UI labels are 15–16px at weight 500–600.
- **Paper artefacts only: Martian Mono Variable** (`--font-paper`). Use it on receipts, stamps, flap-board characters, document labels inside the 3D papers, and acknowledgement numbers. **Never** use it for body copy, nav or headings. That would be costume.
- **Future Hindi:** Anek Devanagari, which pairs with Hanken.
- **Scale** (fluid): `--step--1` 0.875rem, `--step-0` 1.0625rem, `--step-1` 1.33rem, `--step-2` 1.77rem, `--step-3` clamp(2.1rem, 1.6rem + 2.2vw, 2.9rem), `--step-4` clamp(2.6rem, 1.8rem + 3.6vw, 4.2rem), `--step-5` clamp(3.2rem, 2rem + 6vw, 7rem) (hero only).
- Use `font-variant-numeric: tabular-nums` for all money. Money is always `formatINR` (en-IN grouping).
- Don't repeat tiny uppercase tracked kickers above every section. One kicker style is allowed, used at most twice per page.

## 4. Space, shape, depth

- Spacing is fluid and deliberately uneven: tight inside groups, very generous between acts. The tokens run from `--space-3xs` to `--space-3xl`.
- **Paper sheets** (`.sheet`): `--paper-50` background, 2px radius (paper has near-square corners), and a layered paper shadow (`--shadow-paper`). An optional ruled background (`.sheet--ruled`) uses a repeating linear-gradient of `--paper-200` lines every 1.75rem, with a stamp-red margin line at 3rem.
- **File tabs:** a folder-tab shape (top-left tab via clip-path or a pseudo-element) for section headers on inner pages and for the services folders.
- **Desk surfaces:** `--forest-900` with a very subtle grain (inline SVG feTurbulence noise, 4–6% opacity) and a soft top-light radial. No blobs.
- Radii: 2px for paper, 12px for UI controls and buttons, 999px for pills.
- **Buttons:** solid, 48px tall on mobile, weight 650. The primary is `--forest-700` on paper and `--mint-300` with forest text on the desk. WhatsApp uses its own token. Hover darkens slightly and adds a 1px lift. Focus is a 3px `--carbon-600` ring on paper and `--mint-300` on the desk.

## 5. Motion

- **Easing:** `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) for reveals, `--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)` for scrubbed timelines. No bounce and no elastic. The one exception is the stamp: a fast drop, a 1-frame squash and a small settle, which is physical rather than cartoon.
- **Tools:**
  - GSAP + ScrollTrigger for scroll-scrubbed stories (hero settle and stamp, receipt printing).
  - three.js via @react-three/fiber for the hero only.
  - Everything else is CSS: transitions, `@keyframes`, and `animation-timeline: view()` where it is supported, with progressive enhancement.
- **No Lenis / smooth-scroll hijacking.** Native scroll only. Pinning is allowed only on the home hero, for at most about 120vh.
- Animate only `transform`, `opacity`, `filter` and `clip-path`, never layout properties.
- **`prefers-reduced-motion: reduce`:**
  - the hero renders a static poster (pre-composed SVG of the stamped stack)
  - scroll stories render in their final state
  - the flap board shows text immediately
  - the receipt is fully printed
  - the WhatsApp chat is fully shown
- **Performance:**
  - The hero canvas loads via `client:idle` after the headline and CTAs have painted. The headline is the LCP element, not the canvas.
  - DPR is capped at 1.75 (1.25 on mobile). Mobile uses fewer papers.
  - Rendering pauses when off-screen (IntersectionObserver) and when the tab is hidden.
  - three.js is loaded only on the home page.

## 6. Page grammar

- **Home:** hero (desk) → flap board strip → services folders (paper) → receipt "how it works" (paper-200 band) → calculators teaser with a live slab staircase (desk) → "not included" stamps (paper) → FAQ teaser (paper) → WhatsApp chat CTA (forest-800) → footer (forest-950, giant wordmark).
- **Inner pages:** a paper background. The page header is a file-tab heading with breadcrumbs. Content sits on a sheet or is set directly on paper, with a sticky "Talk to Avinash" CTA card on desktop and the mobile sticky bar on phones. Checklists are real checkbox sheets that you can tick (local state only) and print (`@media print`).
- **Tools:** worksheet layout. Inputs sit on a ruled sheet, and the result is a receipt slip that "prints" (clip-path reveal) on first result.

## 7. Content constraints (unchanged)

- Owner facts come from `src/config/site.ts`. Missing facts render `<Todo>` placeholders.
- No stats, testimonials, credentials or prices.
- The footer credit "Website designed with ♥ by Anit" links to https://anit.dev.
- Every calculator result carries the estimate disclaimer.
