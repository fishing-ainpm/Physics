import { describe, expect, it } from 'vitest';
import { CONSTANTS, K } from '../src/core/physics/constants';
import { FORMULA_CATALOG } from '../src/core/physics/formulas';
import { analyzeFormula, solveFormula } from '../src/core/physics/formulaSolver';
import { checkEquationDimensions } from '../src/core/units/units';

describe('constantes', () => {
  it('valores exatos do SI', () => {
    expect(K('c')).toBe(299792458);
    expect(K('h')).toBe(6.62607015e-34);
    expect(K('R')).toBeCloseTo(8.314462618, 9);
    expect(new Set(CONSTANTS.map((k) => k.symbol)).size).toBe(CONSTANTS.length);
  });
  it('c = 1/√(μ₀ε₀) com os valores CODATA', () => {
    expect(1 / Math.sqrt(K('mu0') * K('eps0'))).toBeCloseTo(K('c'), 0);
  });
});

describe('catálogo de fórmulas', () => {
  it('todas as fórmulas são analisáveis e dimensionalmente consistentes', () => {
    const constUnits = Object.fromEntries(CONSTANTS.map((k) => [k.symbol, k.unit]));
    for (const f of FORMULA_CATALOG) {
      const a = analyzeFormula(f.expression);
      const declared = new Set(f.variables.map((v) => v.symbol));
      for (const s of a.variables) expect(declared, `${f.id}: variável ${s} não documentada`).toContain(s);
      const units: Record<string, string> = {};
      for (const s of a.constants) units[s] = constUnits[s];
      for (const v of f.variables) units[v.symbol] = v.unit;
      const check = checkEquationDimensions(f.expression, units);
      expect(check.consistent, `${f.id}: ${check.message}`).toBe(true);
    }
  });
});

describe('resolução de fórmulas (exemplos conhecidos)', () => {
  it('E = mc² para 1 kg', () => {
    const r = solveFormula('E = m * c^2', 'E', { m: 1 });
    expect(r.method).toBe('isolamento direto');
    expect(r.values[0]).toBeCloseTo(8.987551787368176e16, 0);
  });
  it('comprimento de pêndulo com período de 2 s (numérico, escala log)', () => {
    const r = solveFormula('T = 2 * pi * sqrt(L / g)', 'L', { T: 2, g: 9.80665 });
    expect(r.values).toHaveLength(1);
    expect(r.values[0]).toBeCloseTo(9.80665 / Math.PI ** 2, 10); // ≈ 0,9936 m
  });
  it('estado fundamental do hidrogênio ≈ −13,6 eV', () => {
    const r = solveFormula('E = -me * qe^4 / (8 * eps0^2 * h^2 * n^2)', 'E', { n: 1 });
    expect(r.values[0] / K('qe')).toBeCloseTo(-13.6057, 3);
  });
  it('raio de Schwarzschild do Sol ≈ 2,95 km', () => {
    const r = solveFormula('r_s = 2 * G * M / c^2', 'r_s', { M: K('Msun') });
    expect(r.values[0]).toBeCloseTo(2953.3, 0);
  });
  it('volume molar a CNTP via PV = nRT (isolamento por polinômio)', () => {
    const r = solveFormula('P * V = n * R * T', 'V', { P: 101325, n: 1, T: 273.15 });
    expect(r.values[0]).toBeCloseTo(0.0224140, 6);
  });
  it('velocidade a partir de γ = 2 → v = (√3/2) c', () => {
    const r = solveFormula('gamma = 1 / sqrt(1 - v^2 / c^2)', 'v', { gamma: 2 });
    const positive = r.values.filter((x) => x > 0);
    expect(positive[0] / K('c')).toBeCloseTo(Math.sqrt(3) / 2, 8);
  });
  it('avalia expressões sem "="', () => {
    expect(solveFormula('2 * c', null, {}).values[0]).toBe(2 * 299792458);
  });
  it('erros claros', () => {
    expect(() => solveFormula('F = m * a', 'F', { m: 2 })).toThrow(/Informe valores para: a/);
    expect(() => solveFormula('F = m * a', null, { m: 2, a: 1 })).toThrow(/Escolha a variável/);
  });
});

describe('renderização LaTeX', () => {
  it('todas as fórmulas do catálogo e suas formas geradas renderizam no KaTeX', async () => {
    const katex = (await import('katex')).default;
    for (const f of FORMULA_CATALOG) {
      expect(() => katex.renderToString(f.tex, { throwOnError: true }), `${f.id} (tex manual)`).not.toThrow();
      const generated = analyzeFormula(f.expression).tex;
      expect(() => katex.renderToString(generated, { throwOnError: true }), `${f.id}: ${generated}`).not.toThrow();
    }
  });
});
