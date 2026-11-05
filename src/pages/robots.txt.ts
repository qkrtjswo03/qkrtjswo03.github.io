import type { APIRoute } from 'astro';
import { site } from '../config';
import { OWNER_ONLY_PATHS, lockedBlogPathnames } from '../lib/post-files';

/** Search engines stay allowed; common AI/training crawlers are asked not to fetch. */
const AI_BOTS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'Google-Extended',
  'ClaudeBot',
  'anthropic-ai',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
  'Diffbot',
  'FacebookBot',
  'Meta-ExternalAgent',
  'Meta-ExternalFetcher',
  'PerplexityBot',
  'cohere-ai',
  'ImagesiftBot',
  'omgili',
  'Amazonbot',
  'PetalBot',
];

export const GET: APIRoute = () => {
  const lines = [
    '# SunJae.Log robots.txt',
    '# Site content is copyrighted. See /license/',
    '',
    'User-agent: *',
    ...OWNER_ONLY_PATHS.map((path) => `Disallow: ${path}`),
    ...lockedBlogPathnames().map((path) => `Disallow: ${path}`),
    'Allow: /',
    '',
  ];
  for (const bot of AI_BOTS) {
    lines.push(`User-agent: ${bot}`);
    lines.push('Disallow: /');
    lines.push('');
  }
  lines.push(`Sitemap: ${site.url}/sitemap-index.xml`);
  lines.push('');
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
