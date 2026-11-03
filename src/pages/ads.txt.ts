import type { APIRoute } from 'astro';
import { adsTxtBody } from '../lib/ads';

export const GET: APIRoute = () => {
  return new Response(adsTxtBody(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
