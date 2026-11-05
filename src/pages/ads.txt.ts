import type { APIRoute } from 'astro';
import { adsTxtBody } from '../lib/ads';

export const GET: APIRoute = () => {
  const body = adsTxtBody();
  if (!body) {
    return new Response(null, { status: 404, statusText: 'Not Found' });
  }
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
