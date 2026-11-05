import { site } from '../config';

export const DEFAULT_OG_IMAGE = '/og-default.png';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
/** 잠긴 글의 메타·OG·JSON-LD에 넣는 문구. 본문과 프론트매터 설명은 넣지 않는다. */
export const LOCKED_META_DESCRIPTION = '잠긴 글입니다. 본문은 공개하지 않습니다.';

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, site.url).href;
}

export function postOgPath(slug: string): string {
  return `/og/posts/${slug}.png`;
}

function excerpt(markdown: string): string {
  const text = markdown
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 140 ? `${text.slice(0, 139).trim()}…` : text;
}

/** 글 설명. 프론트매터 description이 있으면 그것을, 없으면 본문 앞부분을 쓴다. 잠긴 글은 본문을 쓰지 않는다. */
export function metaDescription(input: { locked?: boolean; description?: string; body?: string | null }): string {
  if (input.locked) return LOCKED_META_DESCRIPTION;
  const written = input.description?.replace(/\s+/g, ' ').trim();
  if (written) return written;
  return excerpt(input.body ?? '') || site.description;
}

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
