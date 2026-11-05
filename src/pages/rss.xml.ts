import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { site } from '../config';
import { getPosts, postUrl } from '../lib/posts';
import { metaDescription } from '../lib/seo';

export const GET: APIRoute = async (context) => {
  const posts = (await getPosts()).filter((post) => !post.data.locked);
  return rss({
    title: site.title,
    description: site.description,
    site: context.site ?? site.url,
    trailingSlash: true,
    customData: '<language>ko-kr</language>',
    items: posts.map((post) => ({
      title: post.data.title,
      description: metaDescription({ description: post.data.description, body: post.body }),
      pubDate: post.data.pubDate,
      link: postUrl(post),
      categories: [...(post.data.categories ?? []), ...(post.data.tags ?? [])],
    })),
  });
};
