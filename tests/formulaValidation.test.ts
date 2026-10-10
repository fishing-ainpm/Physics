import { describe, expect, it } from 'vitest';
import { FORMULA_CATALOG } from '../src/core/physics/formulas';
import { analyzeFormula, solveFormula, validateFormulaText } from '../src/core/physics/formulaSolver';

const rejects = (text: string, message: RegExp, allowEquation = true) =>
  expect(() => validateFormulaText(text, allowEquation), text).toThrow(message);

describe('validação: texto comum é rejeitado', () => {
  it.each([
    'sua mãe de quatrão',
    'sua mae de quatrao',
    'olá mundo',
    'ola mundo',
    'qual a velocidade da luz',
    'energia igual massa vezes luz',
    'E = massa vezes c ao quadrado',
    'calcule a força',
  ])('“%s”', (text) => rejects(text, /parece texto comum/));

  it('não cria variáveis para as palavras de uma frase', () => {
    expect(() => analyzeFormula('sua mãe de quatrão')).toThrow(/parece texto comum/);
    expect(() => solveFormula('sua mae de quatrao', null, {})).toThrow(/parece texto comum/);
  });
});

describe('validação: erros de sintaxe com mensagem clara', () => {
  it('falta de operador entre variáveis', () => rejects('F = m a', /Falta um operador entre “m” e “a”.*m\*a/));
  it.each([
    ['mãe = 2', /acento/],
    ['λ = h/p', /acento ou caractere não permitido/],
    ['x = 2 ; y = 3', /Caractere não permitido: “;”/],
    ['a[1] + 2', /Caractere não permitido: “\[”/],
    ['x > 2', /Caractere não permitido: “>”/],
    ['x == 2', /operador “==”/],
    ['"abc" + 1', /Caractere não permitido/],
    ['x to cm', /palavra reservada/],
    ['a and b', /palavra reservada/],
    ['foo(x) = 2', /não é uma função conhecida/],
    ['F = m(a + b)', /“m\(…\)” não é uma função conhecida.*m\*\(…\)/],
    ['y = sin + 1', /“sin” é uma função; use sin\(…\)/],
    ['x = 1 = 2', /apenas um sinal/],
    ['', /Digite uma fórmula/],
    ['2 * (3 + 4', /Parêntese|esperado|incompleta/],
    ['a'.repeat(40) + ' = 1', /longo demais/],
  ])('“%s”', (text, message) => rejects(text, message));

  it('gráfico não aceita “=”', () => rejects('y = x^2', /sem “=”/, false));
});

describe('validação: fórmulas válidas continuam aceitas', () => {
  it('todas as fórmulas do catálogo', () => {
    for (const f of FORMULA_CATALOG) expect(() => validateFormulaText(f.expression), f.id).not.toThrow();
  });
  it.each([
    'E = m*c^2',
    'E = m * c^2',
    'F = G * m1 * m2 / r^2',
    'v_esc = sqrt(2 * G * M / r)',
    'lambda_max = bWien / T',
    'T_h = 2*T_c',
    'psi = A * sin(k*x - omega*t)',
    'y = 2x + 3',
    'y = 2 x + 3',
    'x^2 - 5x + 6 = 0',
    'n = 7 mod 3',
    'gamma = 1 / sqrt(1 - v^2 / c^2)',
    'S = kB * log(Omega)',
    'E = hbar * omega * (n + 1/2)',
    'P = sigmaSB * A * T^4',
    'r = abs(q) * B',
    'k = 5!',
    'z = atan2(y, x)',
    'massa = 2 * volume',
    '-x + 1.5e-3',
  ])('“%s”', (text) => expect(() => validateFormulaText(text)).not.toThrow());

  it('mantém variáveis e constantes reconhecidas', () => {
    const a = analyzeFormula('v_esc = sqrt(2 * G * M / r)');
    expect(a.variables.sort()).toEqual(['M', 'r', 'v_esc']);
    expect(a.constants).toEqual(['G']);
  });
});
