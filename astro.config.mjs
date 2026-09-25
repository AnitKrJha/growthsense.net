// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// Production domain (matches the info@growthsense.net email). Override with PUBLIC_SITE_URL for previews.
// Tolerates an empty value, a bare domain ("growthsense.net") or a trailing slash, and falls back if still invalid.
const DEFAULT_SITE_URL = 'https://growthsense.net';
/** @param {string | undefined} raw */
function resolveSiteUrl(raw) {
  const v = (raw ?? '').trim().replace(/\/+$/, '');
  if (!v) return DEFAULT_SITE_URL;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    console.warn(`[astro.config] Ignoring invalid PUBLIC_SITE_URL "${raw}", using ${DEFAULT_SITE_URL}`);
    return DEFAULT_SITE_URL;
  }
}
const SITE_URL = resolveSiteUrl(process.env.PUBLIC_SITE_URL);

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'never',
  build: { format: 'directory' },
  integrations: [react(), sitemap()],
  vite: {
    // Pre-bundle client deps up front so the dev server doesn't re-optimise (and force a reload) mid-session.
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'lucide-react',
        'react-icons/fa',
        'three',
        '@react-three/fiber',
        'gsap',
        'gsap/ScrollTrigger',
      ],
    },
  },
});
