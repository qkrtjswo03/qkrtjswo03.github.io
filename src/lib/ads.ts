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

/** 게시자 ID가 없으면 null. 있으면 ads.txt 한 줄. 설명용 주석 파일은 만들지 않습니다. */
export function adsTxtBody(value = site.adsensePublisherId): string | null {
  const id = adsensePublisherId(value);
  if (!id) return null;
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
  const slotId = adSlotId(slot);
  if (!id || !slotId) return null;
  const markup = insTag(id, {
    layout: 'in-article',
    format: 'fluid',
    slot: slotId,
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
