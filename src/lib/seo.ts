import { site } from '../config';

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, site.url).href;
}

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
