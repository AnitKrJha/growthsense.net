#!/usr/bin/env node
/**
 * Post-build SEO audit over dist/**\/*.html. Fails the build (exit 1) on errors; prints warnings.
 * Checks every route for: <html lang>, unique <title> and meta description, absolute canonical, robots,
 * the full Open Graph + Twitter set, that og:image points at a real generated file, one <h1>, valid JSON-LD,
 * and that indexable pages are listed in the sitemap.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const errors = [];
const warnings = [];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else if (entry.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const meta = (html, attr, key) => {
  const re = new RegExp(`<meta[^>]*${attr}="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content="([^"]*)"/i)?.[1];
  return content === undefined ? undefined : decode(content);
};
const exists = async (p) => stat(p).then(() => true, () => false);

const files = (await walk(DIST)).sort();
const sitemapXml = await readFile(join(DIST, 'sitemap-0.xml'), 'utf8').catch(() => '');
const sitemapUrls = new Set([...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/\/$/, '')));
const titles = new Map();
const descriptions = new Map();
let site;

for (const file of files) {
  const rel = relative(DIST, file).split(sep).join('/');
  const route = '/' + rel.replace(/(^|\/)index\.html$/, '').replace(/\.html$/, '');
  const html = await readFile(file, 'utf8');
  const err = (m) => errors.push(`${route}: ${m}`);
  const warn = (m) => warnings.push(`${route}: ${m}`);
  const is404 = rel === '404.html';

  if (!/<html[^>]*\slang="[^"]+"/i.test(html)) err('missing <html lang>');

  const title = decode(html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '').trim();
  if (!title) err('missing <title>');
  else {
    if (title.length > 70) warn(`title is ${title.length} chars (aim for ≤ 70): "${title}"`);
    if (titles.has(title)) err(`duplicate <title> with ${titles.get(title)}`);
    titles.set(title, route);
  }

  const desc = meta(html, 'name', 'description');
  if (!desc) err('missing meta description');
  else {
    if (desc.length < 50 || desc.length > 175) warn(`meta description is ${desc.length} chars (aim for 50–175)`);
    if (descriptions.has(desc)) err(`duplicate meta description with ${descriptions.get(desc)}`);
    descriptions.set(desc, route);
  }

  const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];
  if (!canonical) err('missing canonical');
  else {
    const u = new URL(canonical);
    site ??= u.origin;
    if (u.protocol !== 'https:') err(`canonical is not https: ${canonical}`);
    if (u.origin !== site) err(`canonical origin ${u.origin} differs from ${site}`);
    if (!is404 && (u.pathname.replace(/\/$/, '') || '/') !== (route.replace(/\/$/, '') || '/'))
      err(`canonical path ${u.pathname} does not match route`);
  }

  const robots = meta(html, 'name', 'robots');
  if (!robots) err('missing meta robots');
  else if (is404 && !/noindex/.test(robots)) err('404 must be noindex');
  else if (!is404 && /noindex/.test(robots)) warn('page is noindex');

  for (const key of ['og:type', 'og:site_name', 'og:locale', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt', 'og:image:width', 'og:image:height', 'og:image:type']) {
    if (!meta(html, 'property', key)) err(`missing ${key}`);
  }
  for (const key of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt']) {
    if (!meta(html, 'name', key)) err(`missing ${key}`);
  }
  if (meta(html, 'name', 'twitter:card') !== 'summary_large_image') err('twitter:card should be summary_large_image');

  const ogImage = meta(html, 'property', 'og:image');
  if (ogImage) {
    const u = new URL(ogImage);
    if (u.protocol !== 'https:') err(`og:image is not absolute https: ${ogImage}`);
    const imgFile = join(DIST, decodeURIComponent(u.pathname));
    if (!(await exists(imgFile))) err(`og:image file not generated: ${u.pathname}`);
    else {
      const bytes = (await stat(imgFile)).size;
      if (bytes > 300 * 1024) warn(`og:image is ${Math.round(bytes / 1024)} KB (WhatsApp previews prefer < 300 KB)`);
    }
    if (meta(html, 'name', 'twitter:image') !== ogImage) err('twitter:image differs from og:image');
  }
  if (meta(html, 'property', 'og:url') !== canonical) err('og:url differs from canonical');

  const h1s = html.match(/<h1[\s>]/gi)?.length ?? 0;
  if (h1s !== 1) err(`expected exactly one <h1>, found ${h1s}`);

  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      if (!data['@context'] || !data['@type']) err('JSON-LD block missing @context/@type');
    } catch (e) {
      err(`invalid JSON-LD: ${e.message}`);
    }
  }

  if (!is404 && canonical && sitemapXml && !sitemapUrls.has(canonical.replace(/\/$/, ''))) err('not listed in sitemap');
}

const pages = files.length;
for (const w of warnings) console.warn(`  ⚠ ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error(`\nSEO check failed: ${errors.length} error(s) across ${pages} pages.`);
  process.exit(1);
}
console.log(`SEO check passed: ${pages} pages, ${warnings.length} warning(s).`);
