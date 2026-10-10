/**
 * Liga o teclado da tela ao campo de texto que estava em foco.
 */
import { applyKeyAction, type KeyAction } from './keyEdit';

type Editable = HTMLInputElement | HTMLTextAreaElement;

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'number', 'url', '']);

export function isEditable(el: unknown): el is Editable {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(el.type) && !el.readOnly && !el.disabled;
  return false;
}

let lastTarget: Editable | null = null;

/** Passa a acompanhar o último campo de texto focado. Devolve a função que desfaz. */
export function trackEditableFocus(): () => void {
  const onFocus = (e: FocusEvent) => {
    if (isEditable(e.target)) lastTarget = e.target;
  };
  document.addEventListener('focusin', onFocus);
  if (isEditable(document.activeElement)) lastTarget = document.activeElement;
  return () => document.removeEventListener('focusin', onFocus);
}

export function currentTarget(): Editable | null {
  if (lastTarget && lastTarget.isConnected && isEditable(lastTarget)) return lastTarget;
  return null;
}

/** Atribui o valor de um jeito que o React percebe (dispara o evento "input"). */
function setNativeValue(el: Editable, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function selection(el: Editable): [number, number] {
  try {
    if (el.selectionStart !== null && el.selectionEnd !== null) return [el.selectionStart, el.selectionEnd];
  } catch {
    /* input type=number não expõe seleção */
  }
  return [el.value.length, el.value.length];
}

/** Aplica uma tecla ao campo focado. Devolve false se não houver campo. */
export function applyToTarget(action: KeyAction): boolean {
  const el = currentTarget();
  if (!el) return false;
  const [start, end] = selection(el);
  const r = applyKeyAction(el.value, start, end, action);
  if (r.value !== el.value) setNativeValue(el, r.value);
  el.focus({ preventScroll: true });
  try {
    el.setSelectionRange(r.caret, r.caret);
  } catch {
    /* sem suporte a seleção (type=number) */
  }
  return true;
}

/** Aciona o botão principal da página atual (marcado com data-submit). */
export function submitCurrentPage(): boolean {
  const btn = document.querySelector<HTMLButtonElement>('main [data-submit]:not(:disabled)');
  if (!btn) return false;
  btn.click();
  return true;
}
