import sharp from 'sharp';

export const OG_MAX_BYTES = 150 * 1024;

/** 1200x630 PNG를 150KB 아래로 줄입니다. 팔레트 PNG를 먼저 시도하고, 필요하면 JPEG로 바꿉니다. */
export async function compressOgImage(png: Buffer): Promise<{ buffer: Buffer; ext: 'png' | 'jpg' }> {
  const sized = sharp(png).resize(1200, 630, { fit: 'fill' });

  const palette = await sized
    .clone()
    .png({ compressionLevel: 9, palette: true, quality: 70, effort: 10, colours: 64 })
    .toBuffer();
  if (palette.length <= OG_MAX_BYTES) return { buffer: palette, ext: 'png' };

  const tighter = await sized
    .clone()
    .png({ compressionLevel: 9, palette: true, quality: 50, effort: 10, colours: 32 })
    .toBuffer();
  if (tighter.length <= OG_MAX_BYTES) return { buffer: tighter, ext: 'png' };

  for (const quality of [82, 74, 66, 58]) {
    const jpeg = await sized.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
    if (jpeg.length <= OG_MAX_BYTES) return { buffer: jpeg, ext: 'jpg' };
  }

  const last = await sized.clone().jpeg({ quality: 50, mozjpeg: true }).toBuffer();
  return { buffer: last, ext: 'jpg' };
}
