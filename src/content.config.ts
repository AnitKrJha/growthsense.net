import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Service pages. One Markdown file per service in src/content/services; the file name is the slug
 * and must match a key of `site.services` (src/config/site.ts). The Markdown body is rendered as the
 * page introduction. Everything here is "our best reading" of the owner's services: owner to confirm.
 */
const services = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/services' }),
  schema: z.object({
    title: z.string(),
    /** <title> text (brand suffix is added by the layout). */
    seoTitle: z.string(),
    /** Meta description, ~150 characters. */
    description: z.string(),
    /** Sort order on /services and the home page. */
    order: z.number().default(99),
    whoFor: z.array(z.string()).min(1),
    included: z.array(z.string()).min(1),
    /** Document checklists, optionally split into groups (e.g. "Registration" / "Monthly returns"). */
    documents: z.array(z.object({ heading: z.string().optional(), items: z.array(z.string()).min(1) })).min(1),
    process: z.array(z.object({ step: z.string(), detail: z.string() })).min(1),
    /** Rough, honest timeline. No guarantees. */
    timeline: z.string(),
    /** Answers are rendered as HTML (links allowed). */
    faqs: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
    officialLinks: z.array(z.object({ label: z.string(), url: z.url() })).default([]),
    /** Drafts are never built, even when enabled in site.ts. */
    draft: z.boolean().default(false),
  }),
});

export const collections = { services };
