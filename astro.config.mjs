// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// Production domain (matches the info@growthsense.net email). Override with PUBLIC_SITE_URL for previews.
const SITE_URL = process.env.PUBLIC_SITE_URL ?? 'https://growthsense.net';

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
