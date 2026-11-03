import type { APIRoute } from 'astro';
import { site } from '../config';

export const GET: APIRoute = () => {
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap-index.xml\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
