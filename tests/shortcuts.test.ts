import { describe, expect, it } from 'vitest';
import { commandFor, type KeyLike } from '../src/ui/input/shortcuts';

const k = (key: string, code: string, mods: Partial<KeyLike> = {}): KeyLike => ({ key, code, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...mods });

describe('atalhos de teclado', () => {
  it('Alt+número troca de ferramenta, inclusive pelo teclado numérico', () => {
    expect(commandFor(k('1', 'Digit1', { altKey: true }), false)).toEqual({ type: 'tab', index: 0 });
    expect(commandFor(k('7', 'Numpad7', { altKey: true }), true)).toEqual({ type: 'tab', index: 6 });
    // No ABNT2, Alt+2 pode produzir outro caractere; vale a tecla física.
    expect(commandFor(k('@', 'Digit2', { altKey: true }), false)).toEqual({ type: 'tab', index: 1 });
  });
  it('Ctrl+Enter executa, mesmo digitando', () => {
    expect(commandFor(k('Enter', 'Enter', { ctrlKey: true }), true)).toEqual({ type: 'submit' });
    expect(commandFor(k('Enter', 'NumpadEnter', { metaKey: true }), true)).toEqual({ type: 'submit' });
    expect(commandFor(k('Enter', 'Enter'), true)).toBeNull();
  });
  it('Alt+K alterna o teclado matemático', () => {
    expect(commandFor(k('k', 'KeyK', { altKey: true }), true)).toEqual({ type: 'toggleKeyboard' });
  });
  it('"?" só abre a ajuda fora de campos de texto', () => {
    expect(commandFor(k('?', 'Slash', { shiftKey: true }), false)).toEqual({ type: 'help' });
    expect(commandFor(k('?', 'Slash', { shiftKey: true }), true)).toBeNull();
    expect(commandFor(k('F1', 'F1'), true)).toEqual({ type: 'help' });
  });
  it('ignora combinações comuns de edição', () => {
    expect(commandFor(k('c', 'KeyC', { ctrlKey: true }), true)).toBeNull();
    expect(commandFor(k('1', 'Digit1', { ctrlKey: true, altKey: true }), true)).toBeNull(); // AltGr no Windows
  });
});
