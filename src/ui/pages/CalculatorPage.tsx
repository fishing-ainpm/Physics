import { useEffect, useState } from 'react';
import {
  MathError,
  differentiate,
  evaluateExpression,
  formatValue,
  integrateExpression,
  parseAssignments,
  simplifyExpression,
  solveEquation,
  splitEquation,
  toTex,
} from '../../core/math/engine';
import { constantsScope } from '../../core/physics/constants';
import { type CalcMode, useApp } from '../AppContext';
import { ResultPanel, errorState, type ResultState } from '../components/ResultPanel';
import { Tex } from '../components/Tex';

const MODES: { id: CalcMode; label: string; placeholder: string; help: string }[] = [
  { id: 'avaliar', label: 'Avaliar', placeholder: '0.5 * 2 kg * (3 m/s)^2', help: 'Calcula o valor numérico. Aceita unidades (ex.: 3 m/s * 2 s), "to" para converter (5 km to mi) e várias linhas separadas por ";".' },
  { id: 'simplificar', label: 'Simplificar', placeholder: '2x + 3x - x*y/y', help: 'Simplificação simbólica (mathjs.simplify). Identidades trigonométricas não são aplicadas.' },
  { id: 'derivar', label: 'Derivar', placeholder: 'x^3 * sin(x)', help: 'Derivada simbólica em relação à variável escolhida.' },
  { id: 'resolver', label: 'Resolver equação', placeholder: 'x^2 - 2 = 0', help: 'Polinômios de grau ≤ 3: solução fechada. Outros casos: busca numérica (Brent) no intervalo dado.' },
  { id: 'integrar', label: 'Integral definida', placeholder: 'exp(-x^2)', help: 'Integral numérica por Simpson adaptativo entre os limites dados (finitos).' },
];

const EXAMPLES: Record<CalcMode, string[]> = {
  avaliar: ['sqrt(2) * pi', '9.81 m/s^2 * 3 s', '1 eV to J', 'c / (1 + 0.5)', 'a = 3; b = 4; sqrt(a^2 + b^2)'],
  simplificar: ['2x + 3x', 'x*y/x', '(a + b)^2 - (a + b)^2', 'sin(x)/sin(x) + 0'],
  derivar: ['m*v^2/2', 'sin(omega*t)', 'exp(-x^2)', 'log(x)/x'],
  resolver: ['x^2 - 5x + 6 = 0', 'cos(x) = x', 'x^3 = 27', 'tan(x) = 1'],
  integrar: ['sin(x)', 'x^2', 'exp(-x^2)', '1/(1+x^2)'],
};

export function CalculatorPage() {
  const app = useApp();
  const [draft] = useState(() => app.peekDraft('calculadora'));
  useEffect(() => app.clearDraft('calculadora'), [app]);

  const [mode, setMode] = useState<CalcMode>(draft?.mode ?? 'avaliar');
  const [expression, setExpression] = useState(draft?.expression ?? '');
  const [variable, setVariable] = useState(draft?.variable ?? 'x');
  const [min, setMin] = useState(draft?.min ?? (draft?.mode === 'integrar' ? '0' : '-100'));
  const [max, setMax] = useState(draft?.max ?? (draft?.mode === 'integrar' ? '1' : '100'));
  const [params, setParams] = useState(draft?.params ?? '');
  const [useConstants, setUseConstants] = useState(draft?.useConstants ?? true);
  const [result, setResult] = useState<ResultState>({ kind: 'idle' });

  const info = MODES.find((m) => m.id === mode)!;
  const needsVariable = mode === 'derivar' || mode === 'resolver' || mode === 'integrar';
  const needsRange = mode === 'resolver' || mode === 'integrar';

  function changeMode(m: CalcMode) {
    setMode(m);
    setResult({ kind: 'idle' });
    if (m === 'integrar') {
      setMin('0');
      setMax('1');
    } else if (m === 'resolver') {
      setMin('-100');
      setMax('100');
    }
  }

  function scope(): Record<string, number> {
    const base = useConstants ? constantsScope() : {};
    return { ...base, ...parseAssignments(params, base) };
  }

  function bound(text: string, label: string): number {
    const r = evaluateExpression(text, useConstants ? constantsScope() : {});
    if (r.number === undefined) throw new MathError(`${label} deve ser um número real.`);
    return r.number;
  }

  function run() {
    const payload = { mode, expression, variable, min, max, params, useConstants };
    let input = expression;
    try {
      let res: ResultState;
      let output: string;
      switch (mode) {
        case 'avaliar': {
          const r = evaluateExpression(expression, scope());
          let inputTex = '';
          try {
            inputTex = expression.includes(';') ? '' : toTex(expression, false);
          } catch {
            /* sem pré-visualização */
          }
          res = { kind: 'ok', title: 'Valor', tex: inputTex ? `${inputTex} = ${r.tex}` : r.tex, text: r.text };
          output = r.text;
          break;
        }
        case 'simplificar': {
          const r = simplifyExpression(expression);
          res = { kind: 'ok', title: 'Forma simplificada', tex: r.tex, text: r.text };
          output = r.text;
          break;
        }
        case 'derivar': {
          const r = differentiate(expression, variable);
          input = `d/d${variable} [${expression}]`;
          res = { kind: 'ok', title: `Derivada em relação a ${variable}`, tex: `\\frac{d}{d${variable}}\\left(${toTex(expression)}\\right) = ${r.tex}`, text: r.text };
          output = r.text;
          break;
        }
        case 'resolver': {
          const lo = bound(min, 'Mínimo');
          const hi = bound(max, 'Máximo');
          const r = solveEquation(expression, variable, { scope: scope(), min: lo, max: hi });
          input = `${expression}  (para ${variable})`;
          const eq = splitEquation(expression);
          const lines = r.roots.map((x) => `${variable} = ${formatValue(x).text}`);
          res =
            r.roots.length === 0
              ? { kind: 'warn', title: 'Nenhuma raiz real encontrada', text: 'Tente outro intervalo de busca.', notes: r.notes }
              : {
                  kind: 'ok',
                  title: `${r.roots.length} raiz(es) — método ${r.method}`,
                  tex: eq ? `${toTex(eq.lhs)} = ${toTex(eq.rhs)}` : undefined,
                  lines,
                  notes: [...r.notes, `Resíduo máximo |f(x)| = ${r.residual.toExponential(2)}`],
                };
          output = lines.join('; ') || 'sem raízes';
          break;
        }
        case 'integrar': {
          const a = bound(min, 'Limite inferior');
          const b = bound(max, 'Limite superior');
          const r = integrateExpression(expression, variable, a, b, scope());
          input = `∫ ${expression} d${variable}, de ${a} a ${b}`;
          const v = formatValue(r.value);
          res = {
            kind: 'ok',
            title: 'Integral definida',
            tex: `\\int_{${formatValue(a).tex}}^{${formatValue(b).tex}} ${toTex(expression)}\\,d${variable} = ${v.tex}`,
            text: v.text,
            notes: [`Erro estimado ≈ ${r.errorEstimate.toExponential(2)} (${r.evaluations} avaliações)`],
          };
          output = v.text;
          break;
        }
      }
      setResult(res);
      app.addHistory({ kind: mode, input, output, ok: true, payload });
    } catch (err) {
      setResult(errorState(err));
      app.addHistory({ kind: mode, input, output: (err as Error).message, ok: false, payload });
    }
  }

  return (
    <>
      <header className="page-header">
        <h1>Calculadora</h1>
        <p>Avalie expressões com unidades, simplifique, derive, resolva equações e calcule integrais definidas.</p>
      </header>
      <div className="tabs" role="tablist">
        {MODES.map((m) => (
          <button key={m.id} role="tab" aria-selected={mode === m.id} onClick={() => changeMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="grid grid-2">
        <section className="card stack">
          <p className="small muted">{info.help}</p>
          <label className="field">
            Expressão
            <textarea
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder={info.placeholder}
              rows={3}
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run();
              }}
            />
          </label>
          <div className="chips">
            {EXAMPLES[mode].map((ex) => (
              <button key={ex} className="chip" onClick={() => setExpression(ex)}>
                {ex}
              </button>
            ))}
          </div>
          {expression.trim() && mode !== 'avaliar' && <Preview expression={expression} />}
          <div className="row">
            {needsVariable && (
              <label className="field" style={{ width: '7rem' }}>
                Variável
                <input value={variable} onChange={(e) => setVariable(e.target.value.trim())} />
              </label>
            )}
            {needsRange && (
              <>
                <label className="field grow">
                  {mode === 'integrar' ? 'Limite inferior' : 'Busca: mínimo'}
                  <input value={min} onChange={(e) => setMin(e.target.value)} />
                </label>
                <label className="field grow">
                  {mode === 'integrar' ? 'Limite superior' : 'Busca: máximo'}
                  <input value={max} onChange={(e) => setMax(e.target.value)} />
                </label>
              </>
            )}
          </div>
          {mode !== 'simplificar' && mode !== 'derivar' && (
            <label className="field">
              Parâmetros (opcional)
              <input value={params} onChange={(e) => setParams(e.target.value)} placeholder="ex.: a = 2; m = 9.11e-31" />
            </label>
          )}
          {mode !== 'simplificar' && mode !== 'derivar' && (
            <label className="check">
              <input type="checkbox" checked={useConstants} onChange={(e) => setUseConstants(e.target.checked)} />
              Usar constantes físicas (c, G, h, hbar, kB, qe, me, ...) — com isto ativo, h é a constante de Planck (use hour para horas)
            </label>
          )}
          <div className="row">
            <button className="btn primary" onClick={run} disabled={!expression.trim()}>
              Calcular
            </button>
            <span className="small muted">Ctrl + Enter</span>
          </div>
        </section>
        <ResultPanel state={result} />
      </div>
    </>
  );
}

function Preview({ expression }: { expression: string }) {
  let tex: string | null = null;
  try {
    const eq = splitEquation(expression);
    tex = eq ? `${toTex(eq.lhs)} = ${toTex(eq.rhs)}` : toTex(expression);
  } catch (err) {
    return <div className="small err-text">{(err as Error).message}</div>;
  }
  return (
    <div className="tex-preview">
      <Tex tex={tex} display />
    </div>
  );
}
