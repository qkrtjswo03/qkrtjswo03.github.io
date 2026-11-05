import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { site } from './src/config';
import { adsTxtBody } from './src/lib/ads';
import { markdownPlugins } from './src/plugins/markdown';

export default defineConfig({
  site: site.url,
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
    }),
    {
      name: 'ads-txt-when-configured',
      hooks: {
        'astro:build:done': async ({ dir }) => {
          if (adsTxtBody()) return;
          await rm(join(fileURLToPath(dir), 'ads.txt'), { force: true });
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
