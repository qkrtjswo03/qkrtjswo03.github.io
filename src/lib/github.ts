import { postSlug, type BlogPost } from './posts';

const repo = 'https://github.com/qkrtjswo03/qkrtjswo03.github.io';

function fileName(post: BlogPost): string {
  const slug = postSlug(post.id);
  return slug.endsWith('.md') ? slug : `${slug}.md`;
}

export function blogFilePath(post: BlogPost): string {
  return `src/content/blog/${fileName(post)}`;
}

/** 하단 터미널에서 새 글 초안 열기 */
export function newPostUrl(): string {
  return '#term-new-post';
}

/** 하단 터미널에서 이 글 편집 */
export function editPostUrl(post: BlogPost): string {
  return `#term-edit-${encodeURIComponent(blogFilePath(post))}`;
}

/** 하단 터미널에서 이 글 삭제 커밋 */
export function deletePostUrl(post: BlogPost): string {
  return `#term-delete-${encodeURIComponent(blogFilePath(post))}`;
}

/** 하단 터미널에서 이 글 locked 토글 */
export function lockPostUrl(post: BlogPost): string {
  return `#term-lock-${encodeURIComponent(blogFilePath(post))}`;
}

export function githubRepoUrl(): string {
  return repo;
}
