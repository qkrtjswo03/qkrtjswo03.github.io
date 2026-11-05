import type { APIRoute } from 'astro';
import { getPosts, plainText, postSlug, postUrl } from '../lib/posts';

export const GET: APIRoute = async () => {
  const posts = await getPosts();
  const index = posts.map((post) => ({
    slug: postSlug(post.id),
    url: postUrl(post),
    title: post.data.title,
    description: post.data.locked ? '' : post.data.description,
    categories: post.data.categories ?? [],
    tags: post.data.tags ?? [],
    body: post.data.locked ? '' : plainText(post.body ?? ''),
    locked: post.data.locked === true,
  }));

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0',
    },
  });
};
