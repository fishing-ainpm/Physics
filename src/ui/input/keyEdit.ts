/**
 * Edição de texto pelo teclado matemático da tela, sem depender do DOM.
 * Recebe o valor atual e a seleção e devolve o novo valor e a posição do cursor.
 */
export type KeyAction =
  | { type: 'insert'; text: string; caretOffset?: number }
  | { type: 'backspace' }
  | { type: 'left' }
  | { type: 'right' }
  | { type: 'clear' };

export interface EditResult {
  value: string;
  caret: number;
}

export function applyKeyAction(value: string, start: number, end: number, action: KeyAction): EditResult {
  const s = Math.max(0, Math.min(start, end, value.length));
  const e = Math.min(value.length, Math.max(start, end));
  switch (action.type) {
    case 'insert': {
      const selected = value.slice(s, e);
      // Função com seleção: "sqrt()" envolve o trecho selecionado → sqrt(trecho).
      if (selected && action.text.endsWith('()')) {
        const wrapped = `${action.text.slice(0, -1)}${selected})`;
        return { value: value.slice(0, s) + wrapped + value.slice(e), caret: s + wrapped.length };
      }
      const offset = action.caretOffset ?? action.text.length;
      return { value: value.slice(0, s) + action.text + value.slice(e), caret: s + offset };
    }
    case 'backspace': {
      if (s !== e) return { value: value.slice(0, s) + value.slice(e), caret: s };
      if (s === 0) return { value, caret: 0 };
      // Apaga um par de parênteses vazio de uma vez: "sqrt(|)" → "sqrt|".
      if (value[s - 1] === '(' && value[s] === ')') return { value: value.slice(0, s - 1) + value.slice(s + 1), caret: s - 1 };
      return { value: value.slice(0, s - 1) + value.slice(s), caret: s - 1 };
    }
    case 'left':
      return { value, caret: s !== e ? s : Math.max(0, s - 1) };
    case 'right':
      return { value, caret: s !== e ? e : Math.min(value.length, e + 1) };
    case 'clear':
      return { value: '', caret: 0 };
  }
}

/** Texto inserido por uma tecla: funções terminadas em "()" deixam o cursor entre os parênteses. */
export function insertAction(text: string): KeyAction {
  return { type: 'insert', text, caretOffset: text.endsWith('()') ? text.length - 1 : text.length };
}
