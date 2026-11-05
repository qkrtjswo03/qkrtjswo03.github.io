/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface SunjaeLockGate {
  intercept: (href: string, mode?: 'navigate' | 'here') => boolean;
  ensureOwner: () => Promise<{ ok: boolean; token?: string; login?: string }>;
}

interface Window {
  SunjaeLock?: SunjaeLockGate;
  __sunjaeChrome?: boolean;
  __sunjaeTermClick?: boolean;
  __sunjaeCopy?: boolean;
  __sunjaeZoom?: boolean;
  __sunjaeStatus?: boolean;
}
