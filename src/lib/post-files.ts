import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface PostFileMeta {
  slug: string;
  title: string;
  description: string;
  pubDate: string;
  category: string;
  locked: boolean;
  draft: boolean;
}

function frontmatter(raw: string): string {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match?.[1] ?? '';
}

function field(fm: string, key: string): string {
  const match = fm.match(new RegExp(`^${key}:\\s*(?:"([^"]*)"|'([^']*)'|([^\\n#]+))\\s*$`, 'm'));
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
}

function firstListItem(fm: string, key: string): string {
  const match = fm.match(new RegExp(`^${key}:\\s*\\n((?:[ \\t]+-[ \\t]+.+\\n?)*)`, 'm'));
  if (!match) return '';
  const item = match[1].match(/^[ \t]+-[ \t]+(.+)$/m)?.[1] ?? '';
  return item.trim().replace(/^["']|["']$/g, '');
}

export function readPostFiles(dir = join(process.cwd(), 'src/content/blog')): PostFileMeta[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const fm = frontmatter(readFileSync(join(dir, name), 'utf8'));
      return {
        slug: name.replace(/\.md$/i, ''),
        title: field(fm, 'title'),
        description: field(fm, 'description'),
        pubDate: field(fm, 'pubDate'),
        category: firstListItem(fm, 'categories'),
        locked: /^locked:\s*true\s*$/m.test(fm),
        draft: /^draft:\s*true\s*$/m.test(fm),
      };
    });
}

/** 사이트맵·robots에서 뺄 잠긴 글 경로. 초안은 빌드되지 않는다. */
export function lockedBlogPathnames(): string[] {
  return readPostFiles()
    .filter((post) => post.locked && !post.draft)
    .map((post) => `/blog/${post.slug}/`);
}

export const OWNER_ONLY_PATHS = ['/terminal/'];
