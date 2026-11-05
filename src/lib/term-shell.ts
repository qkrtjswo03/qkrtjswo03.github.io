/**
 * 터미널 명령 파서, 메모리 파일시스템, vim ex 명령, 히스토리.
 * DOM·GitHub API에 의존하지 않아 단위 테스트할 수 있습니다.
 */

export function parseCommand(raw: string): { cmd: string; args: string[] } | null {
  const line = raw.trim();
  if (!line) return null;
  const parts = line.match(/"[^"]*"|\S+/g) ?? [];
  const cmd = parts[0] ?? '';
  const args = parts.slice(1).map((part) => part.replace(/^"|"$/g, ''));
  return { cmd, args };
}

export function normalizePath(p: string): string {
  return p.replace(/^\.?\//, '').replace(/\/+$/, '');
}

export function resolveFsPath(cwd: string, raw: string): string {
  const target = raw.trim();
  if (!target) return cwd;
  if (target.startsWith('/')) return normalizePath(target);
  return normalizePath(cwd ? `${cwd}/${target}` : target);
}

export type FsEntry = { name: string; type: 'file' | 'dir'; size: number };

export class MemoryFS {
  cwd = '';
  readonly files: Map<string, string>;

  constructor(files: Record<string, string> = {}) {
    this.files = new Map(Object.entries(files).map(([key, value]) => [normalizePath(key), value]));
  }

  private dirSet(): Set<string> {
    const dirs = new Set<string>(['']);
    for (const path of this.files.keys()) {
      const segments = path.split('/');
      let acc = '';
      for (let i = 0; i < segments.length - 1; i += 1) {
        acc = acc ? `${acc}/${segments[i]}` : segments[i]!;
        dirs.add(acc);
      }
    }
    return dirs;
  }

  isDir(path: string): boolean {
    return this.dirSet().has(normalizePath(path));
  }

  isFile(path: string): boolean {
    return this.files.has(normalizePath(path));
  }

  ls(raw?: string): { ok: true; entries: FsEntry[] } | { ok: false; error: string } {
    const path = raw ? resolveFsPath(this.cwd, raw) : this.cwd;
    if (this.isFile(path) && !this.isDir(path)) {
      const content = this.files.get(path) ?? '';
      const name = path.split('/').pop() || path;
      return { ok: true, entries: [{ name, type: 'file', size: content.length }] };
    }
    if (path && !this.isDir(path)) return { ok: false, error: `없는 경로입니다: ${path}` };

    const prefix = path ? `${path}/` : '';
    const names = new Map<string, FsEntry>();
    for (const filePath of this.files.keys()) {
      if (path && !filePath.startsWith(prefix)) continue;
      const rest = path ? filePath.slice(prefix.length) : filePath;
      if (!rest) continue;
      const [name, ...nested] = rest.split('/');
      if (!name) continue;
      if (nested.length) {
        if (!names.has(name)) names.set(name, { name, type: 'dir', size: 0 });
      } else {
        names.set(name, { name, type: 'file', size: (this.files.get(filePath) ?? '').length });
      }
    }
    const entries = [...names.values()].sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1,
    );
    return { ok: true, entries };
  }

  cat(raw: string): { ok: true; path: string; content: string } | { ok: false; error: string } {
    if (!raw) return { ok: false, error: '경로를 적어주세요.' };
    const path = resolveFsPath(this.cwd, raw);
    if (this.isDir(path) && !this.isFile(path)) {
      return { ok: false, error: `폴더입니다: ${path || '/'}. ls 로 보세요.` };
    }
    const content = this.files.get(path);
    if (content == null) return { ok: false, error: `없는 파일입니다: ${path}` };
    return { ok: true, path, content };
  }

  cd(raw?: string): { ok: true; cwd: string } | { ok: false; error: string } {
    const next = !raw || raw === '/' || raw === '~' ? '' : resolveFsPath(this.cwd, raw);
    if (next && this.isFile(next) && !this.isDir(next)) {
      return { ok: false, error: `폴더가 아닙니다: ${next}` };
    }
    if (next && !this.isDir(next)) return { ok: false, error: `없는 경로입니다: ${next}` };
    this.cwd = next;
    return { ok: true, cwd: next };
  }
}

export type EditorBuffer = { path: string; content: string };

export type VimResult = {
  write: boolean;
  close: boolean;
  path?: string;
  content?: string;
  message: string;
  cls: string;
};

export function applyVimCommand(cmd: string, editor: EditorBuffer | null): VimResult {
  if (cmd === ':q' || cmd === ':q!') {
    if (!editor) return { write: false, close: false, message: '편집기가 열려 있지 않습니다.', cls: 'dim' };
    return { write: false, close: true, path: editor.path, message: '편집기를 닫았습니다.', cls: 'ok' };
  }
  if (cmd === ':w' || cmd === ':wq' || cmd === ':wq!' || cmd === ':x') {
    if (!editor) return { write: false, close: false, message: '저장할 편집기가 없습니다.', cls: 'warn' };
    return {
      write: true,
      close: cmd !== ':w',
      path: editor.path,
      content: editor.content,
      message: `${editor.path} 내용을 담았습니다. 커밋 버튼으로 저장소에 반영하세요.`,
      cls: 'ok',
    };
  }
  return { write: false, close: false, message: `${cmd}: 없는 명령입니다.`, cls: 'warn' };
}

export type HistoryState = { entries: string[]; at: number; draft: string };

export function createHistory(): HistoryState {
  return { entries: [], at: 0, draft: '' };
}

export function historyPush(state: HistoryState, line: string): HistoryState {
  const entries = line.trim() ? [...state.entries, line] : [...state.entries];
  return { entries, at: entries.length, draft: '' };
}

export function historyRecall(
  state: HistoryState,
  direction: 'up' | 'down',
  currentInput: string,
): { history: HistoryState; value: string } {
  if (!state.entries.length) return { history: state, value: currentInput };
  let { entries, at, draft } = state;
  if (direction === 'up') {
    if (at === entries.length) draft = currentInput;
    at = Math.max(0, at - 1);
  } else if (at < entries.length) {
    at += 1;
  }
  const value = at === entries.length ? draft : (entries[at] ?? '');
  return { history: { entries, at, draft }, value };
}

export type ShellSession = {
  fs: MemoryFS;
  editor: EditorBuffer | null;
  dirty: Map<string, string>;
  history: HistoryState;
};

export function createSession(files: Record<string, string> = {}): ShellSession {
  return {
    fs: new MemoryFS(files),
    editor: null,
    dirty: new Map(),
    history: createHistory(),
  };
}

export function runLine(session: ShellSession, raw: string): { output: string[]; error?: string } {
  const parsed = parseCommand(raw);
  if (!parsed) return { output: [] };
  session.history = historyPush(session.history, raw);
  const { cmd, args } = parsed;

  if (cmd === 'ls') {
    const result = session.fs.ls(args[0]);
    if (!result.ok) return { output: [], error: result.error };
    if (!result.entries.length) return { output: ['(비어 있음)'] };
    return {
      output: result.entries.map((entry) =>
        entry.type === 'dir' ? `${entry.name}/` : `${entry.name} ${entry.size} B`,
      ),
    };
  }

  if (cmd === 'cat') {
    const result = session.fs.cat(args[0] ?? '');
    if (!result.ok) return { output: [], error: result.error };
    return { output: [result.content] };
  }

  if (cmd === 'cd') {
    const result = session.fs.cd(args[0]);
    if (!result.ok) return { output: [], error: result.error };
    return { output: [] };
  }

  if (cmd === ':q' || cmd === ':q!' || cmd === ':w' || cmd === ':wq' || cmd === ':wq!' || cmd === ':x') {
    const result = applyVimCommand(cmd, session.editor);
    if (result.write && result.path != null) {
      session.dirty.set(result.path, result.content ?? '');
    }
    if (result.close) session.editor = null;
    return {
      output: [result.message],
      error: result.cls === 'warn' || result.cls === 'err' ? result.message : undefined,
    };
  }

  return { output: [], error: `${cmd}: 없는 명령입니다. help 를 입력해 보세요.` };
}
