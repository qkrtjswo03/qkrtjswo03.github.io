import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  frontmatterSaysLocked,
  normalizeBlogPath,
  pathFromLockHash,
  toggleLockedFrontmatter,
} from './post-lock.ts';

describe('toggleLockedFrontmatter', () => {
  it('unlocks locked: true', () => {
    const src = '---\ntitle: A\nlocked: true\n---\n\nbody\n';
    const result = toggleLockedFrontmatter(src);
    assert.equal(result.nextLocked, false);
    assert.match(result.content, /^locked: false$/m);
    assert.doesNotMatch(result.content, /^locked: true$/m);
  });

  it('locks locked: false', () => {
    const src = '---\ntitle: A\nlocked: false\n---\n\nbody\n';
    const result = toggleLockedFrontmatter(src);
    assert.equal(result.nextLocked, true);
    assert.match(result.content, /^locked: true$/m);
  });

  it('inserts locked: true when the field is missing', () => {
    const src = '---\ntitle: A\n---\n\nbody\n';
    const result = toggleLockedFrontmatter(src);
    assert.equal(result.nextLocked, true);
    assert.match(result.content, /^locked: true$/m);
  });
});

describe('frontmatterSaysLocked', () => {
  it('detects a locked document', () => {
    assert.equal(frontmatterSaysLocked('---\nlocked: true\n---\n'), true);
    assert.equal(frontmatterSaysLocked('---\nlocked: false\n---\n'), false);
  });
});

describe('path helpers', () => {
  it('normalizes and decodes lock hashes', () => {
    assert.equal(normalizeBlogPath('./src/content/blog/a.md'), 'src/content/blog/a.md');
    assert.equal(
      pathFromLockHash('#term-lock-src%2Fcontent%2Fblog%2Fa.md'),
      'src/content/blog/a.md',
    );
  });
});
