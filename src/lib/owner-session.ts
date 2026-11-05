/**
 * 저장소 주인 인증.
 * 토큰은 localStorage에 두지 않고 이 탭의 sessionStorage에만 둡니다.
 * 잠금 해제·잠금 전환은 저장된 로그인 문자열이 아니라 GitHub /user 응답으로 확인합니다.
 */

export const TOKEN_KEY = 'blog-terminal-token';
export const USER_KEY = 'blog-terminal-user';
export const OWNER_MODE = 'owner-mode';

export type OwnerCheck = {
  ok: boolean;
  login: string;
  token: string;
  /** 401 등 토큰 자체가 거절된 경우 */
  invalid?: boolean;
  error?: string;
};

type CacheSlot = { token: string; promise: Promise<OwnerCheck> };

const globalOwner = globalThis as typeof globalThis & { __sunjaeOwner?: CacheSlot };

function githubHeaders(token: string, extra?: Record<string, string>): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    ...extra,
  };
}

/** 예전 localStorage 토큰은 이 탭 세션으로 옮긴 뒤 지웁니다. */
export function purgeLegacyToken(): void {
  try {
    const legacy = localStorage.getItem(TOKEN_KEY);
    const legacyUser = localStorage.getItem(USER_KEY);
    if (legacy && !sessionStorage.getItem(TOKEN_KEY)) sessionStorage.setItem(TOKEN_KEY, legacy);
    if (legacyUser && !sessionStorage.getItem(USER_KEY)) sessionStorage.setItem(USER_KEY, legacyUser);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('blog-posts-unlocked');
    sessionStorage.removeItem('blog-post-unlock-session');
    sessionStorage.removeItem('blog-posts-unlocked');
  } catch {
    /* private mode */
  }
}

export function readSession(): { token: string; login: string } {
  purgeLegacyToken();
  try {
    return {
      token: sessionStorage.getItem(TOKEN_KEY) ?? '',
      login: sessionStorage.getItem(USER_KEY) ?? '',
    };
  } catch {
    return { token: '', login: '' };
  }
}

export function saveOwnerSession(token: string, login: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, login);
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

export function applyOwnerFlag(on: boolean): void {
  try {
    if (on) localStorage.setItem(OWNER_MODE, '1');
    else localStorage.removeItem(OWNER_MODE);
  } catch {
    /* ignore */
  }
  if (on) document.documentElement.setAttribute('data-owner', '1');
  else document.documentElement.removeAttribute('data-owner');
}

/** 잠금 전환 버튼은 이 속성이 있을 때만 보입니다. localStorage 깃발만으로는 켜지지 않습니다. */
export function markVerified(on: boolean): void {
  if (on) document.documentElement.setAttribute('data-owner-verified', '1');
  else document.documentElement.removeAttribute('data-owner-verified');
}

export function clearOwnerSession(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(OWNER_MODE);
    localStorage.removeItem('blog-posts-unlocked');
  } catch {
    /* ignore */
  }
  document.documentElement.removeAttribute('data-owner');
  document.documentElement.removeAttribute('data-owner-verified');
  delete globalOwner.__sunjaeOwner;
}

export function rememberVerified(token: string, check: OwnerCheck): void {
  globalOwner.__sunjaeOwner = { token, promise: Promise.resolve({ ...check, token }) };
}

export async function verifyOwnerToken(token: string, owner: string): Promise<OwnerCheck> {
  const expected = owner.trim().toLowerCase();
  if (!token || !expected) return { ok: false, login: '', token: '', invalid: true };
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: githubHeaders(token),
      cache: 'no-store',
    });
    if (res.status === 401) return { ok: false, login: '', token: '', invalid: true };
    if (!res.ok) {
      let message = '';
      try {
        const body = (await res.json()) as { message?: string };
        message = String(body.message ?? '');
      } catch {
        /* keep empty */
      }
      if (/bad credentials/i.test(message)) return { ok: false, login: '', token: '', invalid: true };
      return {
        ok: false,
        login: '',
        token,
        error: 'GitHub에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      };
    }
    const data = (await res.json()) as { login?: string };
    const login = String(data.login ?? '');
    if (!login) return { ok: false, login: '', token: '', invalid: true };
    return { ok: login.toLowerCase() === expected, login, token };
  } catch {
    return {
      ok: false,
      login: '',
      token,
      error: 'GitHub에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    };
  }
}

/** 이 페이지 안에서는 같은 토큰을 한 번만 /user 로 확인합니다. */
export function ensureOwner(owner: string): Promise<OwnerCheck> {
  const { token } = readSession();
  if (!token) {
    markVerified(false);
    applyOwnerFlag(false);
    return Promise.resolve({ ok: false, login: '', token: '', invalid: true });
  }
  const slot = globalOwner.__sunjaeOwner;
  if (slot?.token === token) return slot.promise;
  const promise = verifyOwnerToken(token, owner).then((result) => {
    // 확인 중에 다른 토큰으로 바뀌었으면 이 결과는 버리기
    if (readSession().token !== token) return result;
    if (result.ok) {
      saveOwnerSession(token, result.login);
      applyOwnerFlag(true);
      markVerified(true);
    } else if (result.invalid) {
      clearOwnerSession();
    } else {
      markVerified(false);
    }
    document.dispatchEvent(new CustomEvent('blog:owner-session', { detail: { ok: result.ok } }));
    return result;
  });
  globalOwner.__sunjaeOwner = { token, promise };
  return promise;
}

export function normalizeSitePath(href: string): string {
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return '';
    let path = url.pathname;
    if (path.length > 1 && !path.endsWith('/')) path += '/';
    return path;
  } catch {
    return '';
  }
}

export function stripFrontmatter(text: string): string {
  const match = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? text.slice(match[0].length) : text;
}

/**
 * 잠긴 글 원문. 페이지 HTML에는 본문을 넣지 않고, 주인 토큰으로만 가져옵니다.
 * 저장소가 공개면 GitHub 쪽 파일은 토큰 없이도 읽을 수 있습니다.
 */
export async function fetchRepoMarkdown(token: string, repo: string, path: string, ref = 'main'): Promise<string> {
  const encoded = path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${encoded}?ref=${encodeURIComponent(ref)}`,
    { headers: githubHeaders(token), cache: 'no-store' },
  );
  if (!res.ok) throw new Error('본문을 가져오지 못했습니다. 토큰 권한을 확인해 주세요.');
  const data = (await res.json()) as { content?: string; download_url?: string };
  if (data.content) {
    const binary = atob(String(data.content).replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return stripFrontmatter(new TextDecoder().decode(bytes));
  }
  if (data.download_url) {
    const raw = await fetch(data.download_url, { headers: githubHeaders(token), cache: 'no-store' });
    if (!raw.ok) throw new Error('본문을 가져오지 못했습니다.');
    return stripFrontmatter(await raw.text());
  }
  throw new Error('본문을 가져오지 못했습니다.');
}

export async function renderMarkdownHtml(token: string, repo: string, markdown: string): Promise<string> {
  const res = await fetch('https://api.github.com/markdown', {
    method: 'POST',
    headers: githubHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ text: markdown, mode: 'gfm', context: repo }),
  });
  if (!res.ok) throw new Error('본문을 표시하지 못했습니다.');
  return sanitizeHtml(await res.text());
}

const ALLOWED = new Set([
  'a', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'pre', 'code', 'blockquote',
  'strong', 'em', 'del', 's', 'hr', 'br', 'img', 'figure', 'figcaption', 'table', 'thead',
  'tbody', 'tr', 'th', 'td', 'span', 'div', 'sup', 'sub', 'kbd', 'dl', 'dt', 'dd', 'details',
  'summary', 'caption',
]);

const DROP = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'form', 'input', 'button',
  'textarea', 'svg', 'math', 'noscript', 'template',
]);

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const clean = (parent: Node) => {
    for (const node of [...parent.childNodes]) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (DROP.has(tag) || !ALLOWED.has(tag)) {
        if (DROP.has(tag)) el.remove();
        else el.replaceWith(doc.createTextNode(el.textContent ?? ''));
        continue;
      }
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on') || name === 'style' || name === 'srcdoc' || name === 'formaction') {
          el.removeAttribute(attr.name);
          continue;
        }
        if (tag === 'a' && name === 'href') {
          const href = attr.value.trim();
          if (!/^(https?:|mailto:|\/|#)/i.test(href)) el.removeAttribute(attr.name);
          else if (/^https?:/i.test(href)) {
            el.setAttribute('rel', 'noopener noreferrer');
            el.setAttribute('target', '_blank');
          }
          continue;
        }
        if (tag === 'img' && name === 'src') {
          const src = attr.value.trim();
          if (!/^(https?:|\/)/i.test(src)) el.removeAttribute(attr.name);
          continue;
        }
        if (name === 'alt' || name === 'title') continue;
        if ((tag === 'td' || tag === 'th') && (name === 'colspan' || name === 'rowspan')) continue;
        if (tag === 'ol' && name === 'start') continue;
        if (name === 'id' && /^[A-Za-z][\w:-]*$/.test(attr.value)) continue;
        if (
          (tag === 'span' || tag === 'div' || tag === 'pre' || tag === 'code') &&
          name === 'class' &&
          /^[\w\s:-]+$/.test(attr.value)
        ) {
          continue;
        }
        el.removeAttribute(attr.name);
      }
      clean(el);
    }
  };
  clean(doc.body);
  return doc.body.innerHTML;
}
