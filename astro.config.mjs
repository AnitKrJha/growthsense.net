// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// TODO(owner): replace with the real domain once known. Used for canonical URLs, og:image and sitemap.xml.
const SITE_URL = process.env.PUBLIC_SITE_URL ?? 'https://example.com';

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
