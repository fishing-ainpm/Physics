/**
 * Atalhos do teclado físico (pensados para o teclado do Windows, ABNT2 ou US).
 * Função pura para poder ser testada sem navegador.
 */
export type Command =
  | { type: 'tab'; index: number }
  | { type: 'submit' }
  | { type: 'toggleKeyboard' }
  | { type: 'help' }
  | { type: 'escape' };

export interface KeyLike {
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export function commandFor(e: KeyLike, typingInField: boolean): Command | null {
  // Alt+1…7: trocar de ferramenta (usa a tecla física, não o caractere).
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  if (e.altKey && !e.ctrlKey && !e.metaKey && digit) return { type: 'tab', index: Number(digit[1]) - 1 };
  // Ctrl+Enter (ou Cmd+Enter): calcular / executar.
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === 'Enter') return { type: 'submit' };
  // Alt+K: abrir/fechar o teclado matemático.
  if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyK') return { type: 'toggleKeyboard' };
  // F1, ou "?" fora de um campo de texto: lista de atalhos.
  if (e.key === 'F1' && !e.ctrlKey && !e.altKey && !e.metaKey) return { type: 'help' };
  if (e.key === '?' && !typingInField && !e.ctrlKey && !e.altKey && !e.metaKey) return { type: 'help' };
  if (e.key === 'Escape') return { type: 'escape' };
  return null;
}

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Ctrl + Enter', action: 'Calcular / executar na página atual' },
  { keys: 'Alt + 1 … 7', action: 'Ir para Editor, Calculadora, Simulações, Gráficos, Unidades, Biblioteca, Histórico' },
  { keys: 'Alt + K', action: 'Abrir ou fechar o teclado matemático' },
  { keys: 'F1  ou  ?', action: 'Mostrar esta lista de atalhos' },
  { keys: 'Esc', action: 'Fechar o teclado matemático ou esta janela' },
  { keys: 'Tab / Shift + Tab', action: 'Avançar / voltar entre campos e botões' },
];
