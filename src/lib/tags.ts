/** 태그 URL은 소문자 슬러그만 쓰고, 화면 이름은 원래 대소문자를 유지합니다. */

export function tagSlug(tag: string): string {
  return tag
    .split('/')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .join('/');
}

export function tagPath(slug: string): string {
  const segment = slug
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `/tags/${segment}/`;
}

export function nicerTagLabel(a: string, b: string): string {
  const score = (value: string) => {
    const upper = (value.match(/[A-Z]/g) ?? []).length;
    const lower = (value.match(/[a-z]/g) ?? []).length;
    const mixed = upper > 0 && lower > 0 ? 8 : 0;
    return upper * 3 + mixed + value.length * 0.01;
  };
  return score(a) >= score(b) ? a : b;
}

export type TagGroup<T> = {
  slug: string;
  label: string;
  aliases: string[];
  count: number;
  posts: T[];
};

export function groupPostsByTag<T extends { data: { tags?: string[] } }>(posts: T[]): TagGroup<T>[] {
  const map = new Map<string, TagGroup<T>>();
  for (const post of posts) {
    const seen = new Set<string>();
    for (const raw of post.data.tags ?? []) {
      const slug = tagSlug(raw);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      const existing = map.get(slug);
      if (!existing) {
        map.set(slug, { slug, label: raw, aliases: [raw], count: 1, posts: [post] });
        continue;
      }
      existing.count += 1;
      existing.posts.push(post);
      if (!existing.aliases.includes(raw)) existing.aliases.push(raw);
      existing.label = nicerTagLabel(existing.label, raw);
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'ko'));
}
