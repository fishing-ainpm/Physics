import { describe, expect, it } from 'vitest';
import { applyKeyAction, insertAction } from '../src/ui/input/keyEdit';

describe('teclado matemático: edição', () => {
  it('insere no cursor e posiciona dentro dos parênteses', () => {
    expect(applyKeyAction('2*', 2, 2, insertAction('sqrt()'))).toEqual({ value: '2*sqrt()', caret: 7 });
    expect(applyKeyAction('ab', 1, 1, insertAction('+'))).toEqual({ value: 'a+b', caret: 2 });
  });
  it('substitui a seleção e envolve com função', () => {
    expect(applyKeyAction('x+1', 0, 3, insertAction('7'))).toEqual({ value: '7', caret: 1 });
    expect(applyKeyAction('2*x+1', 2, 5, insertAction('sin()'))).toEqual({ value: '2*sin(x+1)', caret: 10 });
  });
  it('apaga caractere, seleção e par de parênteses vazio', () => {
    expect(applyKeyAction('abc', 3, 3, { type: 'backspace' })).toEqual({ value: 'ab', caret: 2 });
    expect(applyKeyAction('abc', 0, 2, { type: 'backspace' })).toEqual({ value: 'c', caret: 0 });
    expect(applyKeyAction('sqrt()', 5, 5, { type: 'backspace' })).toEqual({ value: 'sqrt', caret: 4 });
    expect(applyKeyAction('abc', 0, 0, { type: 'backspace' })).toEqual({ value: 'abc', caret: 0 });
  });
  it('move o cursor e limpa', () => {
    expect(applyKeyAction('abc', 1, 1, { type: 'left' }).caret).toBe(0);
    expect(applyKeyAction('abc', 0, 0, { type: 'left' }).caret).toBe(0);
    expect(applyKeyAction('abc', 3, 3, { type: 'right' }).caret).toBe(3);
    expect(applyKeyAction('abc', 0, 2, { type: 'right' }).caret).toBe(2);
    expect(applyKeyAction('abc', 1, 1, { type: 'clear' })).toEqual({ value: '', caret: 0 });
  });
  it('tolera seleção invertida ou fora do texto', () => {
    expect(applyKeyAction('abc', 9, 9, insertAction('d'))).toEqual({ value: 'abcd', caret: 4 });
    expect(applyKeyAction('abc', 2, 0, { type: 'backspace' })).toEqual({ value: 'c', caret: 0 });
  });
});
