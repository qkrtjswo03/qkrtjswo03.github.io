import type { APIRoute } from 'astro';
import { getPosts, terminalPostIndex } from '../lib/posts';

/** 터미널용 글 색인. 페이지 HTML에 심지 않고 처음 쓸 때 받아 옵니다. 잠긴 글 본문은 비웁니다. */
export const GET: APIRoute = async () => {
  const index = terminalPostIndex(await getPosts());

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0',
    },
  });
};
