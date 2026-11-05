import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyVimCommand,
  createSession,
  historyPush,
  historyRecall,
  parseCommand,
  resolveFsPath,
  runLine,
} from './term-shell.ts';

const files = {
  'README.md': 'hello root',
  'src/content/blog/one.md': '# one\nbody',
  'src/content/blog/two.md': '# two',
};

test('parseCommand splits quoted args', () => {
  assert.deepEqual(parseCommand('  '), null);
  assert.deepEqual(parseCommand('ls src'), { cmd: 'ls', args: ['src'] });
  assert.deepEqual(parseCommand('save -m "hello world"'), { cmd: 'save', args: ['-m', 'hello world'] });
  assert.deepEqual(parseCommand(':wq'), { cmd: ':wq', args: [] });
});

test('ls lists directories then files', () => {
  const session = createSession(files);
  const root = runLine(session, 'ls');
  assert.equal(root.error, undefined);
  assert.deepEqual(root.output, ['src/', 'README.md 10 B']);

  const nested = runLine(session, 'ls src/content/blog');
  assert.ok(nested.output.includes('one.md 10 B'));
  assert.ok(nested.output.includes('two.md 5 B'));
});

test('cd and cat resolve relative paths', () => {
  const session = createSession(files);
  assert.equal(runLine(session, 'cd src/content').error, undefined);
  assert.equal(session.fs.cwd, 'src/content');
  const listed = runLine(session, 'ls');
  assert.deepEqual(listed.output, ['blog/']);

  assert.equal(runLine(session, 'cd blog').error, undefined);
  const cat = runLine(session, 'cat one.md');
  assert.equal(cat.error, undefined);
  assert.equal(cat.output[0], '# one\nbody');

  assert.equal(runLine(session, 'cd /').error, undefined);
  assert.equal(session.fs.cwd, '');
  assert.match(runLine(session, 'cd README.md').error ?? '', /폴더가 아닙니다/);
  assert.match(runLine(session, 'cat missing.md').error ?? '', /없는 파일/);
});

test('resolveFsPath matches the live terminal', () => {
  assert.equal(resolveFsPath('', '/src/content'), 'src/content');
  assert.equal(resolveFsPath('src', 'content/blog'), 'src/content/blog');
  assert.equal(resolveFsPath('src/content', ''), 'src/content');
});

test(':w :q :wq operate on the editor buffer', () => {
  const session = createSession(files);
  session.editor = { path: 'README.md', content: 'edited' };

  const wrote = runLine(session, ':w');
  assert.equal(wrote.error, undefined);
  assert.equal(session.dirty.get('README.md'), 'edited');
  assert.ok(session.editor);

  const quit = runLine(session, ':q');
  assert.equal(quit.error, undefined);
  assert.equal(session.editor, null);

  session.editor = { path: 'src/content/blog/one.md', content: 'new body' };
  const wq = runLine(session, ':wq');
  assert.equal(session.dirty.get('src/content/blog/one.md'), 'new body');
  assert.equal(session.editor, null);
  assert.match(wq.output[0] ?? '', /담았습니다/);

  assert.equal(applyVimCommand(':q', null).cls, 'dim');
  assert.equal(applyVimCommand(':w', null).cls, 'warn');
});

test('history recalls previous commands and restores the draft', () => {
  let history = historyPush({ entries: [], at: 0, draft: '' }, 'ls');
  history = historyPush(history, 'cd src');
  assert.deepEqual(history.entries, ['ls', 'cd src']);
  assert.equal(history.at, 2);

  let step = historyRecall(history, 'up', 'partial');
  assert.equal(step.value, 'cd src');
  step = historyRecall(step.history, 'up', step.value);
  assert.equal(step.value, 'ls');
  step = historyRecall(step.history, 'down', step.value);
  assert.equal(step.value, 'cd src');
  step = historyRecall(step.history, 'down', step.value);
  assert.equal(step.value, 'partial');

  const session = createSession(files);
  runLine(session, 'ls');
  runLine(session, 'cd src');
  const recalled = historyRecall(session.history, 'up', '');
  assert.equal(recalled.value, 'cd src');
});
