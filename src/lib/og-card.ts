import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

type FontAsset = { name: string; data: Buffer; weight: 400 | 700; style: 'normal' };

let fonts: FontAsset[] | null = null;

function loadFonts(): FontAsset[] {
  if (fonts) return fonts;
  const font = (file: string) => join(root, 'node_modules/@fontsource/noto-sans-kr/files', file);
  const latin = font('noto-sans-kr-latin-400-normal.woff');
  const latinBold = font('noto-sans-kr-latin-700-normal.woff');
  const korean = font('noto-sans-kr-korean-400-normal.woff');
  const koreanBold = font('noto-sans-kr-korean-700-normal.woff');
  const read = (file: string) => readFileSync(file);
  fonts = [
    { name: 'Noto Sans KR', data: read(koreanBold), weight: 700, style: 'normal' },
    { name: 'Noto Sans KR', data: read(latinBold), weight: 700, style: 'normal' },
    { name: 'Noto Sans KR', data: read(korean), weight: 400, style: 'normal' },
    { name: 'Noto Sans KR', data: read(latin), weight: 400, style: 'normal' },
  ];
  return fonts;
}

export interface OgCardInput {
  kicker: string;
  title: string;
  detail: string;
  footer: string;
}

function line(text: string, style: Record<string, string | number>): { type: 'div'; props: { style: Record<string, string | number>; children: string } } {
  return { type: 'div', props: { style, children: text } };
}

export async function renderOgSvg(input: OgCardInput): Promise<string> {
  return satori(
    {
      type: 'div',
      props: {
        style: {
          width: `${OG_WIDTH}px`,
          height: `${OG_HEIGHT}px`,
          display: 'flex',
          flexDirection: 'column',
          background: '#050b1f',
          color: '#e7eefc',
          fontFamily: 'Noto Sans KR',
          padding: '56px 64px 48px',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '6px',
                background: '#22d3ee',
              },
            },
          },
          line(input.kicker, {
            color: '#22d3ee',
            fontSize: '28px',
            fontWeight: 400,
          }),
          line(input.title, {
            marginTop: '36px',
            width: '1072px',
            fontSize: '48px',
            fontWeight: 700,
            lineHeight: 1.28,
            color: '#f4f8ff',
          }),
          line(input.detail, {
            marginTop: '28px',
            width: '1072px',
            fontSize: '28px',
            fontWeight: 400,
            lineHeight: 1.45,
            color: '#b7c5e4',
          }),
          line(input.footer, {
            marginTop: '48px',
            fontSize: '26px',
            fontWeight: 400,
            color: '#7dd3fc',
          }),
        ],
      },
    },
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: loadFonts(),
    },
  );
}

export async function renderOgPng(input: OgCardInput): Promise<Buffer> {
  const svg = await renderOgSvg(input);
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } });
  return Buffer.from(resvg.render().asPng());
}
