/**
 * Resolve fórmulas do editor/biblioteca para uma variável escolhida,
 * usando as constantes físicas como escopo padrão (valores SI).
 */
import type { MathNode } from 'mathjs';
import {
  MathError,
  evaluateExpression,
  formatValue,
  freeSymbols,
  parseExpression,
  solveEquation,
  splitEquation,
  toTex,
} from '../math/engine';
import { CONSTANTS, constantsScope } from './constants';

const CONSTANT_SYMBOLS = new Set(CONSTANTS.map((k) => k.symbol));

export interface FormulaAnalysis {
  isEquation: boolean;
  tex: string;
  /** Símbolos livres que não são constantes conhecidas. */
  variables: string[];
  /** Símbolos que correspondem a constantes físicas conhecidas. */
  constants: string[];
}

export function analyzeFormula(expression: string): FormulaAnalysis {
  const eq = splitEquation(expression);
  const text = eq ? `${eq.lhs} == ${eq.rhs}` : expression;
  const node = parseExpression(text);
  const symbols = freeSymbols(node);
  const tex = eq ? `${toTex(eq.lhs)} = ${toTex(eq.rhs)}` : toTex(node);
  return {
    isEquation: !!eq,
    tex,
    variables: symbols.filter((s) => !CONSTANT_SYMBOLS.has(s)),
    constants: symbols.filter((s) => CONSTANT_SYMBOLS.has(s)),
  };
}

export interface FormulaSolveResult {
  target: string | null;
  values: number[];
  texts: string[];
  method: 'avaliação' | 'isolamento direto' | 'polinomial' | 'numérico';
  notes: string[];
}

function isSymbol(node: MathNode, name: string): boolean {
  return node.type === 'SymbolNode' && (node as unknown as { name: string }).name === name;
}

/**
 * @param values valores numéricos (SI) das variáveis conhecidas; podem
 *   também sobrescrever constantes físicas.
 */
export function solveFormula(expression: string, target: string | null, values: Record<string, number>): FormulaSolveResult {
  for (const [k, val] of Object.entries(values)) {
    if (!Number.isFinite(val)) throw new MathError(`Valor inválido para ${k}.`);
  }
  const scope: Record<string, number> = { ...constantsScope(), ...values };
  const eq = splitEquation(expression);

  if (!eq) {
    const r = evaluateExpression(expression, scope);
    if (r.number === undefined) throw new MathError(`O resultado não é um número real: ${r.text}`);
    return { target: null, values: [r.number], texts: [r.text], method: 'avaliação', notes: [] };
  }
  if (!target) throw new MathError('Escolha a variável a calcular.');
  delete scope[target];

  const lhs = parseExpression(eq.lhs);
  const rhs = parseExpression(eq.rhs);
  const missing = [...new Set([...freeSymbols(lhs), ...freeSymbols(rhs)])].filter((s) => s !== target && !(s in scope));
  if (missing.length) throw new MathError(`Informe valores para: ${missing.join(', ')}.`);

  // Caso comum: "alvo = expressão" (ou espelhado) sem o alvo do outro lado.
  for (const [side, other] of [
    [lhs, eq.rhs],
    [rhs, eq.lhs],
  ] as const) {
    if (isSymbol(side, target) && !freeSymbols(other).includes(target)) {
      const r = evaluateExpression(other, scope);
      if (r.number === undefined) throw new MathError(`O resultado não é um número real: ${r.text}`);
      return { target, values: [r.number], texts: [r.text], method: 'isolamento direto', notes: [] };
    }
  }

  const sol = solveEquation(expression, target, { scope, scan: 'log' });
  if (sol.roots.length === 0) {
    throw new MathError(`Nenhuma solução real encontrada para ${target}. ${sol.notes.join(' ')}`);
  }
  return {
    target,
    values: sol.roots,
    texts: sol.roots.map((r) => formatValue(r).text),
    method: sol.method,
    notes: sol.notes,
  };
}
