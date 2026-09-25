/**
 * Build-time Open Graph cards: one 1200×630 PNG per route in src/lib/og/routes.ts, at /og/<slug>.png.
 * Static output, so these are rendered once during `astro build` and served as plain files.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { ogRoutes, type OgRoute } from '@/lib/og/routes';
import { renderOgPng } from '@/lib/og/render';

export const getStaticPaths = (async () => {
  const routes = await ogRoutes();
  return routes.map((route) => ({ params: { slug: route.slug }, props: { route } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ route: OgRoute }> = async ({ props }) => {
  const png = await renderOgPng(props.route);
  return new Response(png as BodyInit, {
    headers: { 'Content-Type': 'image/png' },
  });
};
