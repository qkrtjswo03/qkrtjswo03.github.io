import { getCollection, type CollectionEntry } from 'astro:content';

export type BlogPost = CollectionEntry<'blog'>;

export function postSlug(id: string): string {
  return id.replace(/\.(md|mdx)$/i, '');
}

export function postUrl(post: BlogPost): string {
  return `/blog/${postSlug(post.id)}/`;
}

export function termUrl(kind: 'categories' | 'tags', value: string): string {
  const segment =
    kind === 'tags' ? value.split('/').map((part) => encodeURIComponent(part)).join('/') : encodeURIComponent(value);
  return `/${kind}/${segment}/`;
}

export function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

export function plainText(markdown: string): string {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[a-zA-Z0-9_-]*\n?/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/::affiliate/g, ' ')
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/[*_~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function readingMinutes(markdown: string): number {
  const chars = markdown.replace(/<!--[\s\S]*?-->/g, '').replace(/\s/g, '').length;
  return Math.max(1, Math.round(chars / 450));
}

export function searchText(post: BlogPost): string {
  // k9s `/` 필터: 제목·설명·카테고리·태그만 (본문은 노이즈가 커서 제외)
  return [
    post.data.title,
    post.data.description,
    ...(post.data.categories ?? []),
    ...(post.data.tags ?? []),
  ]
    .join(' ')
    .toLowerCase();
}

export async function getPosts(): Promise<BlogPost[]> {
  const posts = await getCollection('blog', ({ data }) => data.draft !== true);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function neighbors(posts: BlogPost[], slug: string): { newer: BlogPost | null; older: BlogPost | null } {
  const index = posts.findIndex((post) => postSlug(post.id) === slug);
  if (index < 0) return { newer: null, older: null };
  return {
    newer: index > 0 ? posts[index - 1] : null,
    older: index < posts.length - 1 ? posts[index + 1] : null,
  };
}

export function groupByYear(posts: BlogPost[]): Array<[number, BlogPost[]]> {
  const map = new Map<number, BlogPost[]>();
  for (const post of posts) {
    const year = post.data.pubDate.getUTCFullYear();
    const list = map.get(year);
    if (list) list.push(post);
    else map.set(year, [post]);
  }
  return [...map.entries()].sort((a, b) => b[0] - a[0]);
}

export function seriesTitle(id: string): string {
  if (id === 'k8s-hardway') return 'Kubernetes Hard Way HA 설치';
  if (id === 'kubeedge') return 'KubeEdge 엣지 클라우드';
  return id;
}

export function seriesLabel(post: BlogPost): string {
  return post.data.title.replace(/^\[[^\]]+\]\s*/, '');
}

export function postsInSeries(posts: BlogPost[], id: string): BlogPost[] {
  return posts
    .filter((post) => post.data.series === id)
    .sort((a, b) => (a.data.seriesOrder ?? 0) - (b.data.seriesOrder ?? 0));
}

export function groupByCategory(posts: BlogPost[]): Array<{ category: string; posts: BlogPost[] }> {
  const map = new Map<string, BlogPost[]>();
  for (const post of posts) {
    const category = post.data.categories?.[0] ?? '미분류';
    const list = map.get(category);
    if (list) list.push(post);
    else map.set(category, [post]);
  }
  return [...map.entries()]
    .map(([category, list]) => ({
      category,
      posts: [...list].sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()),
    }))
    .sort((a, b) => b.posts[0].data.pubDate.valueOf() - a.posts[0].data.pubDate.valueOf());
}

export function countTerms(posts: BlogPost[], key: 'categories' | 'tags'): Array<[string, number]> {
  const map = new Map<string, number>();
  for (const post of posts) {
    for (const value of post.data[key] ?? []) {
      map.set(value, (map.get(value) ?? 0) + 1);
    }
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko'));
}
