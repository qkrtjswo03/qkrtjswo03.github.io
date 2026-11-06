/** 글 잠금 frontmatter 토글과, Pages 배포 전까지 유지할 대기 상태. */

export const PENDING_LOCKS_KEY = 'blog-pending-locks';
const PENDING_TTL_MS = 6 * 60 * 60 * 1000;

export type PendingLock = {
  path: string;
  locked: boolean;
  at: number;
};

export function normalizeBlogPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

export function isBlogMarkdownPath(path: string): boolean {
  const normalized = normalizeBlogPath(path);
  return normalized.startsWith('src/content/blog/') && normalized.endsWith('.md');
}

export function frontmatterSaysLocked(content: string): boolean {
  return /^locked:\s*(?:true|True|yes)\s*(?:#.*)?$/m.test(content);
}

export function toggleLockedFrontmatter(content: string): { content: string; nextLocked: boolean } {
  let next = content.replace(/\r\n/g, '\n');
  if (/^locked:\s*(?:true|True|yes)\b/m.test(next)) {
    next = next.replace(/^locked:\s*(?:true|True|yes)\b/m, 'locked: false');
    return { content: next, nextLocked: false };
  }
  if (/^locked:\s*(?:false|False|no)\b/m.test(next)) {
    next = next.replace(/^locked:\s*(?:false|False|no)\b/m, 'locked: true');
    return { content: next, nextLocked: true };
  }
  if (/^---\n[\s\S]*?\n---/.test(next)) {
    next = next.replace(/^(---\n[\s\S]*?)(\n---)/, `$1\nlocked: true$2`);
    return { content: next, nextLocked: true };
  }
  throw new Error('frontmatter를 찾지 못했습니다.');
}

function readStore(): PendingLock[] {
  try {
    const raw = localStorage.getItem(PENDING_LOCKS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter((item): item is PendingLock => {
      if (!item || typeof item !== 'object') return false;
      const row = item as PendingLock;
      return typeof row.path === 'string' && typeof row.locked === 'boolean' && typeof row.at === 'number' && now - row.at < PENDING_TTL_MS;
    });
  } catch {
    return [];
  }
}

function writeStore(rows: PendingLock[]): void {
  try {
    localStorage.setItem(PENDING_LOCKS_KEY, JSON.stringify(rows));
  } catch {
    /* private mode */
  }
}

export function readPendingLocks(): PendingLock[] {
  return readStore();
}

export function writePendingLock(path: string, locked: boolean): PendingLock {
  const normalized = normalizeBlogPath(path);
  const next: PendingLock = { path: normalized, locked, at: Date.now() };
  writeStore([...readStore().filter((row) => row.path !== normalized), next]);
  return next;
}

export function clearPendingLock(path: string): void {
  const normalized = normalizeBlogPath(path);
  writeStore(readStore().filter((row) => row.path !== normalized));
}

/** 배포된 HTML의 잠금 값이 대기 상태와 같으면 배포가 끝난 것으로 보고 지웁니다. */
export function reconcilePendingLock(path: string, bakedLocked: boolean): PendingLock | undefined {
  const normalized = normalizeBlogPath(path);
  const pending = readStore().find((row) => row.path === normalized);
  if (!pending) return undefined;
  if (pending.locked === bakedLocked) {
    clearPendingLock(normalized);
    return undefined;
  }
  return pending;
}

export function pathFromLockHash(href: string): string {
  const hash = href.startsWith('#') ? href : href.includes('#') ? href.slice(href.indexOf('#')) : href;
  if (!hash.startsWith('#term-lock-')) return '';
  try {
    return normalizeBlogPath(decodeURIComponent(hash.slice('#term-lock-'.length)));
  } catch {
    return normalizeBlogPath(hash.slice('#term-lock-'.length));
  }
}
