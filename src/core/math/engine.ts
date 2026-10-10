/**
 * Motor matemático da plataforma.
 *
 * Toda a manipulação simbólica e numérica é feita com a biblioteca mathjs
 * (https://mathjs.org). Este módulo não depende de DOM nem de React, para
 * poder ser testado e reutilizado isoladamente.
 */
import { all, create, type MathNode } from 'mathjs';

const math = create(all, { number: 'number', precision: 64 });

// Unidades astronômicas e usuais que o mathjs não traz por padrão.
// Valores: IAU 2012/2015 (au, parsec, ano-luz juliano) e CODATA 2018 (u).
math.createUnit(
  {
    au: { definition: '149597870700 m', aliases: ['astronomicalunit'] },
    lightyear: { definition: '9460730472580800 m', aliases: ['lightyears'] },
    parsec: { definition: '30856775814913673 m', aliases: ['parsecs'] },
    u: { definition: '1.66053906660e-27 kg', aliases: ['Da', 'dalton'] },
    knot: { definition: '0.514444444444444 m/s', aliases: ['knots'] },
    cal: { definition: '4.184 J', prefixes: 'short', aliases: ['calorie', 'calories'] },
    gauss: { definition: '1e-4 T', aliases: ['G_cgs'] },
  },
  { override: false },
);

// O mathjs traz o eV com o valor CODATA 2010; redefinimos com o valor exato do SI 2019.
math.createUnit({ eV: { definition: '1.602176634e-19 J', prefixes: 'short', aliases: ['electronvolt', 'electronvolts'] } }, { override: true });

// Guardamos referências às funções antes de bloqueá-las para o usuário,
// conforme a recomendação de segurança da documentação do mathjs.
const parse = math.parse;
const simplify = math.simplify;
const derivative = math.derivative;
const rationalize = math.rationalize;
const polynomialRoot = math.polynomialRoot;

const blocked = (name: string) => () => {
  throw new Error(`A função "${name}" está desabilitada por segurança.`);
};
math.import(
  {
    import: blocked('import'),
    createUnit: blocked('createUnit'),
    evaluate: blocked('evaluate'),
    parse: blocked('parse'),
    compile: blocked('compile'),
    reviver: blocked('reviver'),
  },
  { override: true },
);

export { math };

/** Erro de entrada ou de cálculo, com mensagem em português. */
export class MathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MathError';
  }
}

export type Scope = Record<string, unknown>;

/** Funções e constantes que não devem ser tratadas como variáveis livres. */
const RESERVED = new Set(['pi', 'e', 'i', 'Infinity', 'NaN', 'true', 'false', 'phi', 'tau', 'null']);

function translateError(err: unknown): MathError {
  if (err instanceof MathError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  let m: RegExpMatchArray | null;
  if ((m = msg.match(/Undefined symbol (\S+)/))) return new MathError(`Símbolo indefinido: ${m[1]}. Atribua um valor a ele.`);
  if ((m = msg.match(/Undefined function (\S+)/))) return new MathError(`Função desconhecida: ${m[1]}.`);
  if (/Unexpected end of expression/.test(msg)) return new MathError('Expressão incompleta.');
  if ((m = msg.match(/Parenthesis \) expected/))) return new MathError('Parêntese ")" esperado.');
  if ((m = msg.match(/Value expected \(char (\d+)\)/))) return new MathError(`Valor esperado na posição ${m[1]}.`);
  if ((m = msg.match(/Unexpected (?:operator|type of argument|character) (.*)/)))
    return new MathError(`Entrada inesperada: ${m[1]}`);
  if (/Units do not match/.test(msg)) return new MathError('As unidades não são compatíveis (dimensões diferentes).');
  if (/Cannot convert/.test(msg)) return new MathError(`Conversão impossível: ${msg}`);
  if (/Division by zero/i.test(msg)) return new MathError('Divisão por zero.');
  return new MathError(msg);
}

/** Converte texto em árvore sintática, com mensagens de erro traduzidas. */
export function parseExpression(expr: string): MathNode {
  const text = expr.trim();
  if (!text) throw new MathError('Digite uma expressão.');
  if (text.length > 2000) throw new MathError('Expressão longa demais (máx. 2000 caracteres).');
  try {
    return parse(text);
  } catch (err) {
    throw translateError(err);
  }
}

/** Converte uma expressão para LaTeX (para exibição com KaTeX). */
export function toTex(expr: string | MathNode): string {
  const node = typeof expr === 'string' ? parseExpression(expr) : expr;
  return node.toTex({ parenthesis: 'auto', implicit: 'hide' });
}

/** Lista símbolos livres (variáveis) de uma expressão, sem funções nem constantes. */
export function freeSymbols(expr: string | MathNode): string[] {
  const node = typeof expr === 'string' ? parseExpression(expr) : expr;
  const found = new Set<string>();
  node.traverse((n, _path, parent) => {
    if (n.type !== 'SymbolNode') return;
    const name = (n as unknown as { name: string }).name;
    // Ignora o nome de uma função chamada, ex.: "sin" em sin(x)
    if (parent && parent.type === 'FunctionNode' && (parent as unknown as { fn: MathNode }).fn === n) return;
    if (RESERVED.has(name)) return;
    // Unidades (m, s, kg...) também aparecem aqui: o usuário pode usar "m"
    // como massa, então quem chama decide como tratá-las.
    found.add(name);
  });
  return [...found];
}

export interface FormattedValue {
  /** Valor bruto retornado pelo mathjs. */
  raw: unknown;
  /** Texto legível. */
  text: string;
  /** Representação em LaTeX. */
  tex: string;
  /** Valor numérico, quando o resultado é um número real. */
  number?: number;
}

export function formatValue(value: unknown, precision = 10): FormattedValue {
  const text = math.format(value as never, { precision, lowerExp: -4, upperExp: 9 });
  let tex = text;
  try {
    tex = parse(text).toTex({ implicit: 'hide' });
  } catch {
    /* mantém texto */
  }
  const out: FormattedValue = { raw: value, text, tex };
  if (typeof value === 'number') out.number = value;
  return out;
}

function assertFinite(value: unknown) {
  if (typeof value === 'number') {
    if (Number.isNaN(value)) throw new MathError('Resultado indefinido (NaN). Verifique o domínio da expressão.');
    if (!Number.isFinite(value)) throw new MathError('Resultado infinito. Verifique divisões por zero ou valores extremos.');
  }
}

/** Avalia uma expressão (aceita unidades, ex.: "3 m/s * 2 s"). */
export function evaluateExpression(expr: string, scope: Scope = {}): FormattedValue {
  const node = parseExpression(expr);
  let value: unknown;
  try {
    value = node.compile().evaluate({ ...scope });
  } catch (err) {
    throw translateError(err);
  }
  if (typeof value === 'function') throw new MathError('A expressão define uma função; chame-a com argumentos.');
  if (value && typeof value === 'object' && 'entries' in (value as object) && Array.isArray((value as { entries: unknown[] }).entries)) {
    const entries = (value as { entries: unknown[] }).entries;
    if (entries.length === 0) throw new MathError('Nenhum resultado.');
    value = entries[entries.length - 1];
  }
  assertFinite(value);
  return formatValue(value);
}

/** Cria f(x) numérica a partir de uma expressão, para gráficos e solvers. */
export function compileFunction(expr: string, variable: string, scope: Scope = {}): (x: number) => number {
  const code = parseExpression(expr).compile();
  const local: Scope = { ...scope };
  return (x: number) => {
    local[variable] = x;
    const v = code.evaluate(local);
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object' && 're' in v && 'im' in v) {
      const c = v as { re: number; im: number };
      return Math.abs(c.im) < 1e-12 * Math.max(1, Math.abs(c.re)) ? c.re : NaN;
    }
    if (typeof v === 'boolean') return v ? 1 : 0;
    return NaN;
  };
}

export interface SymbolicResult {
  text: string;
  tex: string;
}

export function simplifyExpression(expr: string): SymbolicResult {
  const node = parseExpression(expr);
  try {
    const s = simplify(node);
    return { text: s.toString(), tex: s.toTex({ parenthesis: 'auto', implicit: 'hide' }) };
  } catch (err) {
    throw translateError(err);
  }
}

export function differentiate(expr: string, variable: string): SymbolicResult {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable)) throw new MathError('Nome de variável inválido.');
  const node = parseExpression(expr);
  try {
    const d = simplify(derivative(node, variable));
    return { text: d.toString(), tex: d.toTex({ parenthesis: 'auto', implicit: 'hide' }) };
  } catch (err) {
    throw translateError(err);
  }
}

/** Separa "lhs = rhs" (um único "="; "==" não é aceito). */
export function splitEquation(text: string): { lhs: string; rhs: string } | null {
  const parts = text.split(/(?<![<>=!])=(?!=)/);
  if (parts.length === 1) return null;
  if (parts.length > 2) throw new MathError('A equação deve conter apenas um sinal "=".');
  const [lhs, rhs] = parts.map((p) => p.trim());
  if (!lhs || !rhs) throw new MathError('Os dois lados da equação devem estar preenchidos.');
  return { lhs, rhs };
}

export interface SolveOptions {
  scope?: Scope;
  /** Intervalo de busca numérica. */
  min?: number;
  max?: number;
  /** Número de subintervalos para varredura de mudança de sinal. */
  samples?: number;
  /** 'linear' (padrão) usa [min, max]; 'log' varre ordens de grandeza (útil em física). */
  scan?: 'linear' | 'log';
}

export interface SolveResult {
  variable: string;
  roots: number[];
  method: 'polinomial' | 'numérico';
  /** Resíduo máximo |f(raiz)| encontrado. */
  residual: number;
  notes: string[];
}

/**
 * Brent: encontra raiz em [a, b] com f(a)·f(b) < 0.
 * Implementação clássica (Brent, 1973), robusta e de convergência superlinear.
 */
export function brent(f: (x: number) => number, a: number, b: number, tol = 1e-13, maxIter = 200): number {
  let fa = f(a);
  let fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) throw new MathError('Intervalo sem mudança de sinal.');
  let c = a;
  let fc = fa;
  let d = b - a;
  let e = d;
  for (let i = 0; i < maxIter; i++) {
    if (fb * fc > 0) {
      c = a;
      fc = fa;
      d = b - a;
      e = d;
    }
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b;
      b = c;
      c = a;
      fa = fb;
      fb = fc;
      fc = fa;
    }
    const tol1 = 2 * Number.EPSILON * Math.abs(b) + 0.5 * tol;
    const xm = 0.5 * (c - b);
    if (Math.abs(xm) <= tol1 || fb === 0) return b;
    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      const s = fb / fa;
      let p: number;
      let q: number;
      if (a === c) {
        p = 2 * xm * s;
        q = 1 - s;
      } else {
        const qq = fa / fc;
        const r = fb / fc;
        p = s * (2 * xm * qq * (qq - r) - (b - a) * (r - 1));
        q = (qq - 1) * (r - 1) * (s - 1);
      }
      if (p > 0) q = -q;
      p = Math.abs(p);
      if (2 * p < Math.min(3 * xm * q - Math.abs(tol1 * q), Math.abs(e * q))) {
        e = d;
        d = p / q;
      } else {
        d = xm;
        e = d;
      }
    } else {
      d = xm;
      e = d;
    }
    a = b;
    fa = fb;
    b += Math.abs(d) > tol1 ? d : xm > 0 ? tol1 : -tol1;
    fb = f(b);
  }
  return b;
}

function uniqueSorted(values: number[], relTol = 1e-9): number[] {
  const sorted = [...values].sort((x, y) => x - y);
  const out: number[] = [];
  for (const v of sorted) {
    const last = out[out.length - 1];
    if (out.length === 0 || Math.abs(v - last) > relTol * Math.max(1, Math.abs(v))) out.push(v);
  }
  return out;
}

/**
 * Resolve uma equação em uma variável. Tenta primeiro a forma polinomial
 * (grau ≤ 3, solução fechada do mathjs) e, caso contrário, faz busca numérica
 * por mudança de sinal no intervalo [min, max] refinada pelo método de Brent.
 * Raízes de multiplicidade par (sem mudança de sinal) podem não ser detectadas
 * pela busca numérica — isso é informado nas notas.
 */
export function solveEquation(equation: string, variable: string, opts: SolveOptions = {}): SolveResult {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable)) throw new MathError('Nome de variável inválido.');
  const eq = splitEquation(equation);
  const exprText = eq ? `(${eq.lhs}) - (${eq.rhs})` : equation;
  const node = parseExpression(exprText);
  const scope = { ...(opts.scope ?? {}) };
  delete scope[variable];

  if (!freeSymbols(node).includes(variable)) throw new MathError(`A variável "${variable}" não aparece na equação.`);
  const symbols = freeSymbols(node).filter((s) => s !== variable);
  const missing = symbols.filter((s) => !(s in scope));
  if (missing.length) throw new MathError(`Atribua valores para: ${missing.join(', ')}.`);

  const f = compileFunction(exprText, variable, scope);
  const notes: string[] = [];

  // 1) Tentativa polinomial (substituindo os valores numéricos conhecidos).
  try {
    let substituted: MathNode = node;
    if (symbols.length) {
      substituted = node.transform((n) => {
        if (n.type === 'SymbolNode') {
          const name = (n as unknown as { name: string }).name;
          if (name !== variable && name in scope && typeof scope[name] === 'number') {
            return new math.ConstantNode(scope[name] as number);
          }
        }
        return n;
      });
    }
    const rat = rationalize(substituted, {}, true) as unknown as { coefficients: number[]; variables: string[] };
    const coeffs = rat.coefficients;
    if (rat.variables.length === 1 && rat.variables[0] === variable && coeffs.length >= 2 && coeffs.length <= 4) {
      const roots = (polynomialRoot as (...c: number[]) => unknown[])(...coeffs);
      const real: number[] = [];
      for (const r of roots) {
        if (typeof r === 'number') real.push(r);
        else if (r && typeof r === 'object' && 'im' in r) {
          const c = r as { re: number; im: number };
          if (Math.abs(c.im) < 1e-10 * Math.max(1, Math.abs(c.re))) real.push(c.re);
        }
      }
      // A forma racionalizada pode introduzir raízes espúrias (ex.: denominadores).
      const valid = uniqueSorted(real).filter((r) => {
        const v = f(r);
        // Tolerância relativa à escala dos termos do polinômio em r.
        const scale = coeffs.reduce((acc, c, i) => Math.max(acc, Math.abs(c * r ** i)), 0) || 1;
        return Number.isFinite(v) && Math.abs(v) <= 1e-8 * scale;
      });
      if (valid.length < roots.length) notes.push('Raízes complexas, repetidas ou espúrias foram descartadas.');
      return { variable, roots: valid, method: 'polinomial', residual: maxResidual(f, valid), notes };
    }
  } catch {
    /* não é polinomial: segue para o método numérico */
  }

  // 2) Busca numérica por mudança de sinal numa grade.
  const grid = opts.scan === 'log' ? logGrid() : linearGrid(opts);
  const roots: number[] = [];
  let x0 = grid[0];
  let f0 = f(x0);
  for (let k = 1; k < grid.length; k++) {
    const x1 = grid[k];
    const f1 = f(x1);
    if (Number.isFinite(f0) && Number.isFinite(f1)) {
      if (f0 === 0) roots.push(x0);
      else if (f0 * f1 < 0) {
        // Tolerância relativa à escala do intervalo (raízes podem ser ~1e-30 em SI).
        const r = brent(f, x0, x1, 4e-16 * Math.max(Math.abs(x0), Math.abs(x1)));
        const fr = f(r);
        // Rejeita "raízes" que na verdade são polos (ex.: tan x em π/2).
        if (fr === 0 || (Number.isFinite(fr) && Math.abs(fr) < 1e-6 * Math.max(Math.abs(f0), Math.abs(f1)))) roots.push(r);
      }
    }
    x0 = x1;
    f0 = f1;
  }
  if (Number.isFinite(f0) && f0 === 0) roots.push(x0);
  const unique = uniqueSorted(roots);
  if (opts.scan === 'log') {
    notes.push('Busca numérica em escala logarítmica de ±1e-60 a ±1e60 (método de Brent).');
  } else {
    notes.push(`Busca numérica em [${grid[0]}, ${grid[grid.length - 1]}] com ${grid.length - 1} subintervalos (método de Brent).`);
  }
  notes.push('Raízes sem mudança de sinal (multiplicidade par) ou fora do intervalo podem não aparecer.');
  return { variable, roots: unique, method: 'numérico', residual: maxResidual(f, unique), notes };
}

function linearGrid(opts: SolveOptions): number[] {
  const min = opts.min ?? -100;
  const max = opts.max ?? 100;
  if (!(Number.isFinite(min) && Number.isFinite(max)) || min >= max) throw new MathError('Intervalo de busca inválido (mín < máx).');
  const n = Math.min(Math.max(opts.samples ?? 4000, 10), 200000);
  return Array.from({ length: n + 1 }, (_, k) => min + ((max - min) * k) / n);
}

/** Grade simétrica ±10^k (k de -60 a 60, 20 pontos por década) mais o zero. */
function logGrid(): number[] {
  const pos: number[] = [];
  for (let k = -60 * 20; k <= 60 * 20; k++) pos.push(10 ** (k / 20));
  return [...pos.map((v) => -v).reverse(), 0, ...pos];
}

function maxResidual(f: (x: number) => number, roots: number[]): number {
  return roots.reduce((acc, r) => Math.max(acc, Math.abs(f(r))), 0);
}

export interface IntegralResult {
  value: number;
  errorEstimate: number;
  evaluations: number;
}

/**
 * Integral definida numérica por Simpson adaptativo com extrapolação de
 * Richardson. Limites devem ser finitos.
 */
export function integrate(f: (x: number) => number, a: number, b: number, tol = 1e-10, maxDepth = 50): IntegralResult {
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new MathError('Os limites de integração devem ser finitos.');
  if (a === b) return { value: 0, errorEstimate: 0, evaluations: 0 };
  let evaluations = 0;
  const F = (x: number) => {
    evaluations++;
    const v = f(x);
    if (!Number.isFinite(v)) throw new MathError(`A função não é finita em x = ${x}. A integral pode ser imprópria.`);
    return v;
  };
  let errSum = 0;
  const simpson = (fa: number, fm: number, fb: number, a0: number, b0: number) => ((b0 - a0) / 6) * (fa + 4 * fm + fb);
  const rec = (a0: number, b0: number, fa: number, fm: number, fb: number, whole: number, eps: number, depth: number): number => {
    const m = (a0 + b0) / 2;
    const lm = (a0 + m) / 2;
    const rm = (m + b0) / 2;
    const flm = F(lm);
    const frm = F(rm);
    const left = simpson(fa, flm, fm, a0, m);
    const right = simpson(fm, frm, fb, m, b0);
    const delta = left + right - whole;
    if (depth <= 0 || Math.abs(delta) <= 15 * eps) {
      errSum += Math.abs(delta) / 15;
      return left + right + delta / 15;
    }
    return rec(a0, m, fa, flm, fm, left, eps / 2, depth - 1) + rec(m, b0, fm, frm, fb, right, eps / 2, depth - 1);
  };
  const fa = F(a);
  const fb = F(b);
  const fm = F((a + b) / 2);
  const value = rec(a, b, fa, fm, fb, simpson(fa, fm, fb, a, b), tol, maxDepth);
  return { value, errorEstimate: errSum, evaluations };
}

/** Integral definida de uma expressão textual em relação a uma variável. */
export function integrateExpression(expr: string, variable: string, a: number, b: number, scope: Scope = {}): IntegralResult {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable)) throw new MathError('Nome de variável inválido.');
  const symbols = freeSymbols(expr).filter((s) => s !== variable);
  const missing = symbols.filter((s) => !(s in scope));
  if (missing.length) throw new MathError(`Atribua valores para: ${missing.join(', ')}.`);
  const f = compileFunction(expr, variable, scope);
  return integrate(f, a, b);
}

/** Amostra y = f(x) para gráficos; valores não finitos viram null (lacunas). */
export function sampleFunction(
  expr: string,
  variable: string,
  min: number,
  max: number,
  samples: number,
  scope: Scope = {},
): { x: number[]; y: (number | null)[] } {
  if (!(Number.isFinite(min) && Number.isFinite(max)) || min >= max) throw new MathError('Intervalo inválido (mín < máx).');
  const n = Math.min(Math.max(Math.round(samples), 2), 20000);
  const f = compileFunction(expr, variable, scope);
  const x: number[] = [];
  const y: (number | null)[] = [];
  for (let k = 0; k < n; k++) {
    const xv = min + ((max - min) * k) / (n - 1);
    let yv: number;
    try {
      yv = f(xv);
    } catch (err) {
      throw translateError(err);
    }
    x.push(xv);
    y.push(Number.isFinite(yv) ? yv : null);
  }
  // Insere lacunas em assíntotas verticais (ex.: tan x): troca de sinal entre
  // amostras vizinhas cujos módulos crescem em direção ao salto, dos dois lados.
  const gx: number[] = [];
  const gy: (number | null)[] = [];
  for (let k = 0; k < n; k++) {
    if (k >= 2 && k <= n - 2) {
      const a2 = y[k - 2];
      const a = y[k - 1];
      const b = y[k];
      const b2 = y[k + 1];
      if (a2 !== null && a !== null && b !== null && b2 !== null && a * b < 0 &&
          Math.abs(a) > Math.abs(a2) && Math.abs(b) > Math.abs(b2)) {
        gx.push((x[k - 1] + x[k]) / 2);
        gy.push(null);
      }
    }
    gx.push(x[k]);
    gy.push(y[k]);
  }
  return { x: gx, y: gy };
}

export { translateError };
