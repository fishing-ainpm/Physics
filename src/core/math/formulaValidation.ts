/**
 * Validação sintática de fórmulas do editor (e das funções do gráfico).
 *
 * O mathjs aceita quase qualquer texto: "sua mãe de quatrão" vira o produto
 * implícito de quatro variáveis. Aqui só passam expressões matemáticas:
 * números, operadores, funções conhecidas, constantes e identificadores
 * legítimos (letras sem acento, dígitos e "_", como v0, T_h, lambda_max).
 */
import type { MathNode } from 'mathjs';
import { MathError, parseExpression, splitEquation } from './engine';

/** Funções aceitas nas fórmulas (todas existem no mathjs). */
export const ALLOWED_FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'sec', 'csc', 'cot',
  'asin', 'acos', 'atan', 'atan2', 'asec', 'acsc', 'acot',
  'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'exp', 'expm1', 'log', 'log10', 'log2', 'log1p',
  'sqrt', 'cbrt', 'nthRoot', 'pow', 'hypot', 'abs', 'sign',
  'floor', 'ceil', 'round', 'fix', 'min', 'max', 'mod',
  'gamma', 'factorial', 'erf',
]);

/** Funções cujo nome também é uma variável comum em física (γ de Lorentz). */
const ALSO_VARIABLE = new Set(['gamma']);

const ALLOWED_OPERATORS = new Set(['add', 'subtract', 'multiply', 'divide', 'pow', 'unaryMinus', 'unaryPlus', 'factorial', 'mod']);

/** Palavras que o mathjs interpreta como operadores ou valores especiais. */
const RESERVED_WORDS = new Set(['to', 'in', 'and', 'or', 'not', 'xor', 'true', 'false', 'null', 'undefined', 'NaN', 'Infinity', 'end']);

/** Palavras que podem ficar ao lado de outra sem operador ("x mod 3"). */
const INFIX_WORDS = new Set(['mod']);

const MAX_IDENTIFIER = 32;

/** Nomes de letras gregas, usados como variáveis (theta, omega...). */
const GREEK_NAMES = new Set(
  'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega Gamma Delta Theta Lambda Xi Pi Sigma Phi Psi Omega'.split(' '),
);
const ALLOWED_CHARS = /[A-Za-z0-9_\s+\-*/^().,=!]/;

type Token = { type: 'word' | 'number' | 'space' | 'other'; text: string };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /(\p{L}[\p{L}\p{N}_]*)|(\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|(\s+)|([\s\S])/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1]) tokens.push({ type: 'word', text: m[1] });
    else if (m[2]) tokens.push({ type: 'number', text: m[2] });
    else if (m[3]) tokens.push({ type: 'space', text: m[3] });
    else tokens.push({ type: 'other', text: m[4] });
  }
  return tokens;
}

/** Sequências de palavras separadas só por espaço (sem operador entre elas). */
function wordRuns(tokens: Token[]): string[][] {
  const runs: string[][] = [];
  let run: string[] = [];
  let lastWasWord = false;
  let afterSpace = false;
  const flush = () => {
    if (run.length > 1) runs.push(run);
    run = [];
  };
  for (const t of tokens) {
    if (t.type === 'space') {
      afterSpace = true;
      continue;
    }
    if (t.type === 'word' && !INFIX_WORDS.has(t.text)) {
      if (!(lastWasWord && afterSpace)) flush();
      run.push(t.text);
      lastWasWord = true;
    } else {
      flush();
      lastWasWord = false;
    }
    afterSpace = false;
  }
  flush();
  return runs;
}

/** Palavra com cara de linguagem natural: 3+ letras e não é constante nem função conhecida. */
function looksLikeProse(w: string, known: Set<string>): boolean {
  return w.length >= 3 && /^\p{L}+$/u.test(w) && !known.has(w) && !ALLOWED_FUNCTIONS.has(w) && !GREEK_NAMES.has(w);
}

function checkTokens(text: string, knownSymbols: Set<string>) {
  const tokens = tokenize(text);
  const words = tokens.filter((t) => t.type === 'word').map((t) => t.text);

  // 0) Palavras que o mathjs trataria como operadores (to, and, ...).
  for (const w of words) {
    if (RESERVED_WORDS.has(w)) throw new MathError(`“${w}” é uma palavra reservada e não pode ser usada em fórmulas.`);
  }

  // 1) Texto em linguagem natural: palavras seguidas sem operador entre elas.
  for (const run of wordRuns(tokens)) {
    if (run.length >= 3 || run.every((w) => looksLikeProse(w, knownSymbols))) {
      throw new MathError(
        `Isto parece texto comum, não uma fórmula (“${run.join(' ')}”). Escreva uma expressão matemática com operadores entre os termos, por exemplo F = m*a.`,
      );
    }
    const [a, b] = run;
    throw new MathError(`Falta um operador entre “${a}” e “${b}”. Para multiplicar, use ${a}*${b}.`);
  }

  // 2) Identificadores: letras sem acento, dígitos e "_".
  for (const w of words) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(w)) {
      throw new MathError(
        `“${w}” tem acento ou caractere não permitido. Use letras sem acento (a–z), dígitos e “_”; para letras gregas escreva o nome (alpha, theta, omega).`,
      );
    }
    if (w.length > MAX_IDENTIFIER) throw new MathError(`O nome “${w.slice(0, 20)}…” é longo demais (máximo ${MAX_IDENTIFIER} caracteres).`);
  }

  // 3) Demais caracteres.
  for (const t of tokens) {
    if (t.type === 'other' && !ALLOWED_CHARS.test(t.text)) {
      const hint = t.text === ';' ? ' Escreva uma fórmula por vez.' : t.text === '[' || t.text === ']' ? ' Vetores e índices não são suportados.' : '';
      throw new MathError(`Caractere não permitido: “${t.text}”.${hint}`);
    }
  }
  if (/\n/.test(text.trim())) throw new MathError('Escreva a fórmula em uma única linha.');
}

function nodeName(n: MathNode): string {
  return (n as unknown as { name?: string }).name ?? '';
}

function checkTree(root: MathNode) {
  root.traverse((node, _path, parent) => {
    switch (node.type) {
      case 'ConstantNode': {
        const v = (node as unknown as { value: unknown }).value;
        if (typeof v !== 'number') throw new MathError('Texto entre aspas e valores lógicos não são permitidos em fórmulas.');
        return;
      }
      case 'ParenthesisNode':
        return;
      case 'OperatorNode': {
        const op = node as unknown as { fn: string; op: string };
        if (!ALLOWED_OPERATORS.has(op.fn)) throw new MathError(`O operador “${op.op}” não é permitido em fórmulas.`);
        return;
      }
      case 'SymbolNode': {
        const name = nodeName(node);
        const isCallee = parent?.type === 'FunctionNode' && (parent as unknown as { fn: MathNode }).fn === node;
        if (!isCallee && ALLOWED_FUNCTIONS.has(name) && !ALSO_VARIABLE.has(name)) throw new MathError(`“${name}” é uma função; use ${name}(…), por exemplo ${name}(x).`);
        return;
      }
      case 'FunctionNode': {
        const fn = (node as unknown as { fn: MathNode }).fn;
        const name = nodeName(fn);
        if (fn.type !== 'SymbolNode' || !ALLOWED_FUNCTIONS.has(name)) {
          throw new MathError(
            `“${name || 'expressão'}(…)” não é uma função conhecida. Para multiplicar, use ${name || 'a'}*(…). Funções aceitas: sin, cos, tan, exp, log, sqrt, abs e outras.`,
          );
        }
        return;
      }
      case 'AssignmentNode':
      case 'FunctionAssignmentNode':
        throw new MathError('Definições de variável ou função não são suportadas; escreva a fórmula diretamente.');
      case 'AccessorNode':
      case 'IndexNode':
      case 'ArrayNode':
      case 'RangeNode':
        throw new MathError('Vetores, intervalos e índices não são suportados em fórmulas.');
      case 'ConditionalNode':
        throw new MathError('Expressões condicionais (a ? b : c) não são suportadas.');
      case 'BlockNode':
        throw new MathError('Escreva uma fórmula por vez.');
      default:
        throw new MathError('Construção não suportada em fórmulas.');
    }
  });
}

/**
 * Lança MathError com mensagem clara se o texto não for uma fórmula válida.
 * @param allowEquation aceita um único "=" (editor); falso para funções do gráfico.
 * @param knownSymbols constantes conhecidas (ex.: hbar, sigmaSB), que não contam como palavras de texto.
 */
export function validateFormula(text: string, allowEquation = true, knownSymbols: Set<string> = new Set()): void {
  const trimmed = text.trim();
  if (!trimmed) throw new MathError('Digite uma fórmula.');
  checkTokens(trimmed, knownSymbols);
  const eq = splitEquation(trimmed);
  if (eq && !allowEquation) throw new MathError('Escreva só a expressão, sem “=”, por exemplo x^2 + 1.');
  for (const side of eq ? [eq.lhs, eq.rhs] : [trimmed]) checkTree(parseExpression(side));
}
