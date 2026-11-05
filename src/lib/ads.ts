import { site } from '../config';

const ADSENSE_ID = /^ca-pub-\d{10,20}$/;
const SLOT_ID = /^\d{6,20}$/;
const GA_ID = /^G-[A-Z0-9]{4,}$/;
const META_TOKEN = /^[A-Za-z0-9_-]{8,128}$/;

export function adsensePublisherId(value = site.adsensePublisherId): string | null {
  const id = value.trim();
  return ADSENSE_ID.test(id) ? id : null;
}

export function adSlotId(value: string): string | null {
  const id = value.trim();
  return SLOT_ID.test(id) ? id : null;
}

export function gaMeasurementId(value = site.ga4MeasurementId): string | null {
  const id = value.trim();
  return GA_ID.test(id) ? id : null;
}

const GOATCOUNTER_CODE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export function goatcounterCode(value = site.goatcounterCode ?? ''): string | null {
  const code = value.trim();
  return GOATCOUNTER_CODE.test(code) ? code : null;
}

export function siteVerification(value: string): string | null {
  const token = value.trim();
  return META_TOKEN.test(token) ? token : null;
}

export function adsTxtBody(value = site.adsensePublisherId): string {
  const raw = value.trim();
  if (!raw) {
    return [
      '# Google AdSense publisher id가 아직 없습니다.',
      '# src/config.ts 의 adsensePublisherId 에 ca-pub- 로 시작하는 값을 넣으면',
      '# 다음 배포에서 이 파일이 아래 형식으로 바뀝니다.',
      '#',
      '# google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0',
      '',
    ].join('\n');
  }
  const id = adsensePublisherId(raw);
  if (!id) {
    return [
      '# adsensePublisherId 형식이 아닙니다. ca-pub- 다음에 숫자만 와야 합니다.',
      '# 형식이 맞을 때까지 광고 스크립트는 넣지 않습니다.',
      '',
    ].join('\n');
  }
  return `google.com, ${id.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`;
}

function insTag(publisherId: string, options: { layout?: string; format: string; slot: string | null; fullWidth?: boolean }): string {
  const attrs = [
    'class="adsbygoogle"',
    'style="display:block;text-align:center"',
    `data-ad-client="${publisherId}"`,
    `data-ad-format="${options.format}"`,
  ];
  if (options.layout) attrs.push(`data-ad-layout="${options.layout}"`);
  if (options.fullWidth) attrs.push('data-full-width-responsive="true"');
  if (options.slot) attrs.push(`data-ad-slot="${options.slot}"`);
  return `<ins ${attrs.join(' ')}></ins>`;
}

export function inArticleAdHtml(publisher = site.adsensePublisherId, slot = site.adsenseInArticleSlot): string | null {
  const id = adsensePublisherId(publisher);
  if (!id) return null;
  const markup = insTag(id, {
    layout: 'in-article',
    format: 'fluid',
    slot: adSlotId(slot),
  });
  return `<aside class="ad-slot ad-slot-in-article" aria-label="광고"><p class="ad-label">광고</p>${markup}</aside>`;
}

export function sidebarAdHtml(publisher = site.adsensePublisherId, slot = site.adsenseSidebarSlot): string | null {
  const id = adsensePublisherId(publisher);
  if (!id) return null;
  const markup = insTag(id, {
    format: 'auto',
    slot: adSlotId(slot),
    fullWidth: true,
  });
  return `<aside class="ad-slot ad-slot-sidebar" aria-label="광고"><p class="ad-label">광고</p>${markup}</aside>`;
}
