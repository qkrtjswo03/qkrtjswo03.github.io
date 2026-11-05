import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { site } from './src/config';
import { adsTxtBody } from './src/lib/ads';
import { writeOgAssets } from './src/lib/og-build';
import { OWNER_ONLY_PATHS, lockedBlogPathnames } from './src/lib/post-files';
import { markdownPlugins } from './src/plugins/markdown';

const hiddenPaths = new Set([...lockedBlogPathnames(), ...OWNER_ONLY_PATHS]);

export default defineConfig({
  site: site.url,
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        if (path.includes('/404')) return false;
        return !hiddenPaths.has(path);
      },
    }),
    {
      name: 'post-og-images',
      hooks: {
        'astro:build:done': async ({ dir }) => {
          const out = fileURLToPath(dir);
          const count = await writeOgAssets(out);
          console.log(`[og] ${count} post images`);
          if (!adsTxtBody()) await rm(join(out, 'ads.txt'), { force: true });
        },
      },
    },
  ],
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      defaultColor: false,
    },
    processor: satteri({
      features: { smartPunctuation: false },
      mdastPlugins: markdownPlugins,
    }),
  },
});
