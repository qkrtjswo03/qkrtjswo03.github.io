import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { groupPostsByTag, nicerTagLabel, tagPath, tagSlug } from './tags.ts';

describe('tagSlug', () => {
  it('lowercases and keeps path segments', () => {
    assert.equal(tagSlug('Kubernetes'), 'kubernetes');
    assert.equal(tagSlug('CoreDNS'), 'coredns');
    assert.equal(tagSlug('TCP/IP'), 'tcp/ip');
  });
});

describe('tagPath', () => {
  it('builds a trailing-slash URL', () => {
    assert.equal(tagPath('kubernetes'), '/tags/kubernetes/');
    assert.equal(tagPath('tcp/ip'), '/tags/tcp/ip/');
  });
});

describe('nicerTagLabel', () => {
  it('prefers mixed or uppercase display labels', () => {
    assert.equal(nicerTagLabel('kubernetes', 'Kubernetes'), 'Kubernetes');
    assert.equal(nicerTagLabel('coredns', 'CoreDNS'), 'CoreDNS');
    assert.equal(nicerTagLabel('Helm', 'helm'), 'Helm');
  });
});

describe('groupPostsByTag', () => {
  it('merges case variants into one group', () => {
    const posts = [
      { data: { tags: ['kubernetes', 'helm'] } },
      { data: { tags: ['Kubernetes', 'Helm'] } },
      { data: { tags: ['Cilium'] } },
    ];
    const groups = groupPostsByTag(posts);
    const kube = groups.find((group) => group.slug === 'kubernetes');
    const helm = groups.find((group) => group.slug === 'helm');
    assert.ok(kube);
    assert.equal(kube?.count, 2);
    assert.equal(kube?.label, 'Kubernetes');
    assert.deepEqual(kube?.aliases.sort(), ['Kubernetes', 'kubernetes']);
    assert.equal(helm?.label, 'Helm');
    assert.equal(groups.filter((group) => group.slug === 'kubernetes').length, 1);
  });
});
