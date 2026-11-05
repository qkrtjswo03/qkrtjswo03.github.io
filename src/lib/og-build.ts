import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { site } from '../config';
import { renderOgPng } from './og-card';
import { readPostFiles } from './post-files';

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

function displayDate(raw: string): string {
  const day = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day.replaceAll('-', '.') : '';
}

export async function defaultOgPng(): Promise<Buffer> {
  return renderOgPng({
    kicker: 'sunjae@k8s:~$',
    title: site.title,
    detail: site.tagline,
    footer: 'qkrtjswo03.github.io   ·   Ready',
  });
}

export async function writeOgAssets(outDir: string): Promise<number> {
  const shared = await defaultOgPng();
  await writeFile(join(outDir, 'og-default.png'), shared);
  await writeFile(join(outDir, 'og-sunjae.png'), shared);

  const dest = join(outDir, 'og', 'posts');
  await mkdir(dest, { recursive: true });
  const posts = readPostFiles().filter((post) => !post.locked && !post.draft && post.title);
  for (const post of posts) {
    const date = displayDate(post.pubDate);
    const bits = ['SunJae.Log', date, post.category].filter(Boolean);
    const png = await renderOgPng({
      kicker: 'sunjae@k8s:~$  kubectl describe post',
      title: post.title,
      detail: clip(post.description, 42),
      footer: bits.join('   ·   '),
    });
    await writeFile(join(dest, `${post.slug}.png`), png);
  }
  return posts.length;
}
