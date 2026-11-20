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

// Shiki 4.6에는 promql 번들이 없다. 글의 PromQL 펜스가 plaintext로 떨어지지 않게 최소 문법을 붙인다.
const promql = {
  name: 'promql',
  scopeName: 'source.promql',
  displayName: 'PromQL',
  patterns: [
    { include: '#comment' },
    { include: '#string' },
    { include: '#duration' },
    { include: '#number' },
    { include: '#keyword' },
    { include: '#function' },
    { include: '#metric' },
  ],
  repository: {
    comment: { match: '#.*$', name: 'comment.line.number-sign.promql' },
    string: { match: '"(?:\\\\.|[^"\\\\])*"', name: 'string.quoted.double.promql' },
    duration: { match: '\\b\\d+(?:\\.\\d+)?(?:ms|[smhdwy])\\b', name: 'constant.numeric.duration.promql' },
    number: { match: '\\b\\d+(?:\\.\\d+)?\\b', name: 'constant.numeric.promql' },
    keyword: {
      match:
        '\\b(?:sum|min|max|avg|group|count|stddev|stdvar|topk|bottomk|quantile|count_values|by|without|on|ignoring|group_left|group_right|offset|bool|and|or|unless)\\b',
      name: 'keyword.control.promql',
    },
    function: {
      match:
        '\\b(?:rate|irate|increase|delta|deriv|histogram_quantile|label_replace|label_join|abs|ceil|floor|round|clamp|clamp_min|clamp_max|absent|changes|resets)\\b',
      name: 'support.function.promql',
    },
    metric: { match: '\\b[a-zA-Z_:][a-zA-Z0-9_:]*\\b', name: 'variable.other.promql' },
  },
};

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
      langs: [promql],
    },
    processor: satteri({
      features: { smartPunctuation: false },
      mdastPlugins: markdownPlugins,
    }),
  },
});
