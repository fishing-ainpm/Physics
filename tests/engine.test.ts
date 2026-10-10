import { describe, expect, it } from 'vitest';
import {
  MathError,
  brent,
  differentiate,
  evaluateExpression,
  freeSymbols,
  integrate,
  integrateExpression,
  parseAssignments,
  sampleFunction,
  simplifyExpression,
  symbolTex,
  solveEquation,
  toTex,
} from '../src/core/math/engine';

describe('avaliação', () => {
  it('calcula expressões numéricas', () => {
    expect(evaluateExpression('2 + 3 * 4').number).toBe(14);
    expect(evaluateExpression('sqrt(2)^2').number).toBeCloseTo(2, 14);
    expect(evaluateExpression('sin(pi/6)').number).toBeCloseTo(0.5, 14);
    expect(evaluateExpression('x^2 + y', { x: 3, y: 1 }).number).toBe(10);
  });
  it('opera com unidades', () => {
    expect(evaluateExpression('3 m/s * 2 s').text).toBe('6 m');
    expect(evaluateExpression('5 km to m').text).toBe('5000 m');
  });
  it('retorna complexo para raiz de negativo', () => {
    expect(evaluateExpression('sqrt(-4)').text).toBe('2i');
  });
  it('trata erros com mensagens em português', () => {
    expect(() => evaluateExpression('')).toThrow(MathError);
    expect(() => evaluateExpression('x + 1')).toThrow(/Símbolo indefinido: x/);
    expect(() => evaluateExpression('1/0')).toThrow(/infinito/);
    expect(() => evaluateExpression('2 * (3 + 4')).toThrow(MathError);
    expect(() => evaluateExpression('1 m + 1 s')).toThrow(/unidades/i);
  });
  it('bloqueia funções perigosas', () => {
    expect(() => evaluateExpression('import({}, {})')).toThrow();
    expect(() => evaluateExpression('evaluate("1+1")')).toThrow();
  });
});

describe('simbólico', () => {
  it('simplifica', () => {
    expect(simplifyExpression('2x + 3x').text).toBe('5 * x');
    expect(simplifyExpression('x + x + 0*y').text).toBe('2 * x');
    expect(simplifyExpression('x*y/x').text).toBe('y');
  });
  it('deriva', () => {
    expect(differentiate('x^3', 'x').text).toBe('3 * x ^ 2');
    expect(differentiate('sin(x)', 'x').text).toBe('cos(x)');
    expect(differentiate('m*v^2/2', 'v').text).toBe('m * v');
  });
  it('gera LaTeX e símbolos livres', () => {
    expect(toTex('sqrt(x)/2')).toContain('\\sqrt');
    expect(freeSymbols('a*sin(b) + pi*c').sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('equações', () => {
  it('resolve polinômios em forma fechada', () => {
    const r = solveEquation('x^2 - 5x + 6 = 0', 'x');
    expect(r.method).toBe('polinomial');
    expect(r.roots).toEqual([2, 3].map((v) => expect.closeTo(v, 12)));
  });
  it('resolve com parâmetros', () => {
    const r = solveEquation('E = m*c^2', 'm', { scope: { E: 9e16, c: 3e8 } });
    expect(r.roots[0]).toBeCloseTo(1, 12);
  });
  it('resolve transcendentais numericamente', () => {
    const r = solveEquation('cos(x) = x', 'x', { min: -5, max: 5 });
    expect(r.method).toBe('numérico');
    expect(r.roots).toHaveLength(1);
    expect(r.roots[0]).toBeCloseTo(0.7390851332151607, 12); // número de Dottie
  });
  it('não confunde polos com raízes', () => {
    const r = solveEquation('tan(x) = 0', 'x', { min: -2, max: 2 });
    expect(r.roots).toHaveLength(1);
    expect(r.roots[0]).toBeCloseTo(0, 12);
  });
  it('varre ordens de grandeza (escala log)', () => {
    const r = solveEquation('exp(x/1e-20) = 2', 'x', { scan: 'log' });
    expect(r.roots[0]).toBeCloseTo(Math.LN2 * 1e-20, 30);
  });
  it('Brent converge', () => {
    expect(brent((x) => x * x - 2, 0, 2)).toBeCloseTo(Math.SQRT2, 13);
  });
  it('valida entradas', () => {
    expect(() => solveEquation('x = 1 = 2', 'x')).toThrow(/apenas um/);
    expect(() => solveEquation('x + a = 0', 'x')).toThrow(/Atribua valores para: a/);
    expect(() => solveEquation('y = 2', 'x')).toThrow(/não aparece/);
  });
});

describe('integração numérica', () => {
  it('integra funções conhecidas', () => {
    expect(integrate(Math.sin, 0, Math.PI).value).toBeCloseTo(2, 10);
    expect(integrateExpression('exp(-x^2)', 'x', -10, 10).value).toBeCloseTo(Math.sqrt(Math.PI), 9);
    expect(integrateExpression('a*x', 'x', 0, 2, { a: 3 }).value).toBeCloseTo(6, 12);
  });
  it('detecta singularidades', () => {
    expect(() => integrateExpression('1/x', 'x', 0, 1)).toThrow(/não é finita/);
  });
});

describe('amostragem', () => {
  it('insere lacunas em assíntotas', () => {
    const s = sampleFunction('tan(x)', 'x', -3, 3, 301);
    expect(s.y.filter((v) => v === null).length).toBe(2);
  });
  it('marca valores fora do domínio como null', () => {
    const s = sampleFunction('sqrt(x)', 'x', -1, 1, 3);
    expect(s.y).toEqual([null, 0, 1]);
  });
});

describe('atribuições', () => {
  it('avalia em sequência', () => {
    expect(parseAssignments('a = 2; b = 3*a\nc = a + b')).toEqual({ a: 2, b: 6, c: 8 });
  });
  it('usa o escopo base', () => {
    expect(parseAssignments('E = m*c^2', { m: 1, c: 3 })).toEqual({ E: 9 });
  });
  it('rejeita formatos inválidos', () => {
    expect(() => parseAssignments('2 = a')).toThrow(/inválida/);
    expect(() => parseAssignments('pi = 3')).toThrow(/reservado/);
    expect(() => parseAssignments('d = 3 m')).toThrow(/sem unidades/);
  });
});

describe('LaTeX de variáveis', () => {
  it('itálico, índices e letras gregas', () => {
    expect(symbolTex('m')).toBe('m');
    expect(symbolTex('v0')).toBe('{v}_{0}');
    expect(symbolTex('T_h')).toBe('{T}_{h}');
    expect(symbolTex('lambda_max')).toBe('{\\lambda}_{\\mathrm{max}}');
    expect(symbolTex('eps0')).toBe('\\varepsilon_0');
    expect(toTex('m * a')).not.toMatch(/\\cdot[a-z]/);
  });
  it('mantém unidades em romano quando pedido', () => {
    expect(toTex('3 m', false)).toContain('\\mathrm{m}');
  });
});
