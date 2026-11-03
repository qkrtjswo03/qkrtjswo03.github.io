import { postSlug, type BlogPost } from './posts';

const repo = 'https://github.com/qkrtjswo03/qkrtjswo03.github.io';

function fileName(post: BlogPost): string {
  const slug = postSlug(post.id);
  return slug.endsWith('.md') ? slug : `${slug}.md`;
}

export function editPostUrl(post: BlogPost): string {
  return `${repo}/edit/main/src/content/blog/${fileName(post)}`;
}

export function deletePostUrl(post: BlogPost): string {
  return `${repo}/delete/main/src/content/blog/${fileName(post)}`;
}

export function newPostUrl(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const value = `---
title: ""
description: ""
pubDate: ${y}-${m}-${d}
categories:
  - 관측
tags: []
draft: true
---
`;
  const params = new URLSearchParams({ filename: 'new-post.md', value });
  return `${repo}/new/main/src/content/blog?${params.toString()}`;
}
