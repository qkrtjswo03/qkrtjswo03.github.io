/**
 * 터미널용 테마 모달. window.prompt 대신 씁니다.
 * 입력값은 호출한 쪽에만 돌려 주고, 저장소에 넣지 않습니다.
 */

export type PromptOptions = {
  title: string;
  message: string;
  inputType?: 'text' | 'password';
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
};

let openCount = 0;

export function askPrompt(options: PromptOptions): Promise<string | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    openCount += 1;
    const dialog = document.createElement('div');
    dialog.className = 'term-modal';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', `term-modal-title-${openCount}`);

    const titleId = `term-modal-title-${openCount}`;
    dialog.innerHTML = `
      <button type="button" class="term-modal-backdrop" data-term-modal-cancel aria-label="닫기"></button>
      <form class="term-modal-card" autocomplete="off">
        <p class="term-modal-kicker">sunjae@k8s:~$</p>
        <h2 class="term-modal-title" id="${titleId}"></h2>
        <p class="term-modal-desc"></p>
        <label class="sr-only" for="term-modal-input-${openCount}"></label>
        <input
          id="term-modal-input-${openCount}"
          class="term-modal-input"
          spellcheck="false"
          autocapitalize="off"
          autocorrect="off"
        />
        <div class="term-modal-actions">
          <button type="submit" class="term-btn" data-term-modal-ok></button>
          <button type="button" class="term-btn term-btn-ghost" data-term-modal-cancel></button>
        </div>
      </form>
    `;

    const title = dialog.querySelector('.term-modal-title');
    const desc = dialog.querySelector('.term-modal-desc');
    const label = dialog.querySelector('label');
    const input = dialog.querySelector('input');
    const ok = dialog.querySelector<HTMLButtonElement>('[data-term-modal-ok]');
    const form = dialog.querySelector('form');
    if (title) title.textContent = options.title;
    if (desc) desc.textContent = options.message;
    if (label) label.textContent = options.title;
    if (ok) ok.textContent = options.confirmLabel ?? '확인';
    dialog.querySelectorAll('[data-term-modal-cancel]').forEach((node) => {
      if (node instanceof HTMLButtonElement && node.dataset.termModalCancel !== undefined && node.type !== 'submit') {
        if (node.classList.contains('term-btn')) node.textContent = options.cancelLabel ?? '취소';
      }
    });
    const cancelButtons = dialog.querySelectorAll<HTMLButtonElement>('.term-btn[data-term-modal-cancel]');
    cancelButtons.forEach((btn) => {
      btn.textContent = options.cancelLabel ?? '취소';
    });

    if (input) {
      input.type = options.inputType ?? 'text';
      input.value = options.defaultValue ?? '';
      input.placeholder = options.placeholder ?? '';
      input.autocomplete = 'off';
    }

    const finish = (value: string | null) => {
      document.removeEventListener('keydown', onKey, true);
      dialog.remove();
      resolve(value);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        finish(null);
      }
    };

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      finish(input?.value ?? '');
    });
    dialog.querySelectorAll('[data-term-modal-cancel]').forEach((node) => {
      node.addEventListener('click', (event) => {
        event.preventDefault();
        finish(null);
      });
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(dialog);
    window.setTimeout(() => input?.focus(), 0);
  });
}
