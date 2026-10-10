import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { freeSymbols, sampleFunction } from '../../core/math/engine';
import { CONSTANTS, constantsScope } from '../../core/physics/constants';
import type { PlotSpec } from '../../core/simulations/types';
import { useApp } from '../AppContext';
import { Plot } from '../components/Plot';
import { ResultPanel, type ResultState } from '../components/ResultPanel';

const CONST_SET = new Set(CONSTANTS.map((k) => k.symbol));
const MAX_FUNCTIONS = 8;

interface Param {
  value: number;
  lo: number;
  hi: number;
}

/** Faixa inicial do controle deslizante: de 0 a 10·v (ou de −10 a 10 se v = 0). */
function defaultRange(v: number): Param {
  if (v === 0) return { value: 0, lo: -10, hi: 10 };
  return v > 0 ? { value: v, lo: 0, hi: 10 * v } : { value: v, lo: 10 * v, hi: 0 };
}

const PRESETS: { label: string; functions: string[]; variable: string; min: number; max: number; params?: Record<string, number> }[] = [
  { label: 'Oscilador amortecido', functions: ['A * exp(-b*t/2) * cos(w*t)', 'A * exp(-b*t/2)'], variable: 't', min: 0, max: 20, params: { A: 1, b: 0.3, w: 2 } },
  { label: 'Potencial de Lennard-Jones', functions: ['4*eps*((s/r)^12 - (s/r)^6)'], variable: 'r', min: 0.9, max: 3, params: { eps: 1, s: 1 } },
  { label: 'Fator de Lorentz γ(v/c)', functions: ['1/sqrt(1 - beta^2)'], variable: 'beta', min: 0, max: 0.99 },
  { label: 'Planck (corpo negro, λ em m)', functions: ['2*h*c^2/lambda^5 / (exp(h*c/(lambda*kB*T)) - 1)'], variable: 'lambda', min: 1e-7, max: 3e-6, params: { T: 5772 } },
  { label: 'Ondas: batimento', functions: ['sin(w1*t) + sin(w2*t)'], variable: 't', min: 0, max: 60, params: { w1: 1, w2: 1.1 } },
];

export function GraphsPage() {
  const app = useApp();
  const [draft] = useState(() => app.peekDraft('graficos'));
  useEffect(() => app.clearDraft('graficos'), [app]);

  const [functions, setFunctions] = useState<string[]>(draft?.functions ?? ['sin(x)', 'cos(x)']);
  const [variable, setVariable] = useState(draft?.variable ?? 'x');
  const [min, setMin] = useState(String(draft?.min ?? (draft ? 0 : -10)));
  const [max, setMax] = useState(String(draft?.max ?? 10));
  const [samples, setSamples] = useState('600');
  const [logX, setLogX] = useState(false);
  const [logY, setLogY] = useState(false);
  const [useConstants, setUseConstants] = useState(true);
  const [params, setParams] = useState<Record<string, Param>>(() =>
    Object.fromEntries(Object.entries(draft?.params ?? {}).map(([k, v]) => [k, defaultRange(v)])),
  );

  // Parâmetros detectados automaticamente nas expressões.
  const detected = useMemo(() => {
    const set = new Set<string>();
    for (const f of functions) {
      if (!f.trim()) continue;
      try {
        for (const s of freeSymbols(f)) if (s !== variable && !(useConstants && CONST_SET.has(s))) set.add(s);
      } catch {
        /* erro de sintaxe aparece no painel */
      }
    }
    return [...set];
  }, [functions, variable, useConstants]);

  useEffect(() => {
    setParams((prev) => {
      const missing = detected.filter((s) => !(s in prev));
      if (!missing.length) return prev;
      return { ...prev, ...Object.fromEntries(missing.map((s) => [s, defaultRange(1)])) };
    });
  }, [detected]);

  const raw = useMemo(
    () => ({ functions, variable, min, max, samples, params, useConstants, detected }),
    [functions, variable, min, max, samples, params, useConstants, detected],
  );
  const input = useDeferredValue(raw);

  const computed = useMemo((): { spec: PlotSpec | null; state: ResultState } => {
    const lo = Number(input.min);
    const hi = Number(input.max);
    const n = Number(input.samples);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo >= hi) return { spec: null, state: { kind: 'error', message: 'Intervalo inválido: o mínimo deve ser menor que o máximo.' } };
    if (!Number.isInteger(n) || n < 2 || n > 20000) return { spec: null, state: { kind: 'error', message: 'Número de pontos deve ser um inteiro entre 2 e 20000.' } };
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(input.variable)) return { spec: null, state: { kind: 'error', message: 'Nome de variável inválido.' } };
    const scope: Record<string, number> = { ...(input.useConstants ? constantsScope() : {}) };
    for (const s of input.detected) scope[s] = input.params[s]?.value ?? 1;
    const traces = [];
    const errors: string[] = [];
    const notes: string[] = [];
    for (const f of input.functions) {
      if (!f.trim()) continue;
      try {
        const { x, y } = sampleFunction(f, input.variable, lo, hi, n, scope);
        const valid = y.filter((v): v is number => v !== null);
        if (valid.length === 0) errors.push(`${f}: nenhum ponto real no intervalo.`);
        else {
          const gaps = y.length - valid.length;
          if (gaps > 0) notes.push(`${f}: ${gaps} ponto(s) indefinido(s) ou não reais omitidos.`);
          notes.push(`${f}: mín = ${Math.min(...valid).toPrecision(5)}, máx = ${Math.max(...valid).toPrecision(5)}`);
        }
        traces.push({ name: f, x, y });
      } catch (err) {
        errors.push(`${f}: ${(err as Error).message}`);
      }
    }
    if (traces.length === 0) return { spec: null, state: errors.length ? { kind: 'error', message: errors.join(' ') } : { kind: 'idle', message: 'Digite ao menos uma função.' } };
    const spec: PlotSpec = { title: '', xLabel: input.variable, yLabel: 'f(' + input.variable + ')', traces };
    const state: ResultState = errors.length ? { kind: 'warn', title: 'Algumas funções falharam', lines: errors, notes } : { kind: 'ok', title: 'Gráfico gerado', notes };
    return { spec, state };
  }, [input]);

  function updateFunction(i: number, value: string) {
    setFunctions(functions.map((f, k) => (k === i ? value : f)));
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setFunctions(p.functions);
    setVariable(p.variable);
    setMin(String(p.min));
    setMax(String(p.max));
    setLogX(false);
    setLogY(false);
    setParams(Object.fromEntries(Object.entries(p.params ?? {}).map(([k, v]) => [k, defaultRange(v)])));
  }

  function record() {
    const values = Object.fromEntries(detected.map((s) => [s, params[s]?.value ?? 1]));
    app.addHistory({
      kind: 'gráfico',
      input: `${functions.filter((f) => f.trim()).join(' | ')}  (${variable} ∈ [${min}, ${max}])`,
      output: detected.length ? Object.entries(values).map(([k, v]) => `${k}=${v}`).join(', ') : 'sem parâmetros',
      ok: computed.spec !== null,
      payload: { functions, variable, min: Number(min), max: Number(max), params: values },
    });
    app.toast('Gráfico registrado no histórico.');
  }

  return (
    <>
      <header className="page-header">
        <h1>Gráficos interativos</h1>
        <p>Plote várias funções de uma variável. Símbolos extras viram parâmetros ajustáveis por controles deslizantes; use o mouse ou toque para ampliar e mover.</p>
      </header>
      <div className="grid grid-sidebar">
        <div className="stack">
          <section className="card stack">
            <h3>Funções</h3>
            {functions.map((f, i) => (
              <div className="row" key={i}>
                <input className="grow mono" value={f} onChange={(e) => updateFunction(i, e.target.value)} aria-label={`Função ${i + 1}`} placeholder="ex.: x^2" spellCheck={false} />
                <button className="btn small danger" onClick={() => setFunctions(functions.filter((_, k) => k !== i))} disabled={functions.length === 1} aria-label={`Remover função ${i + 1}`}>
                  ✕
                </button>
              </div>
            ))}
            <div className="row">
              <button className="btn small" onClick={() => setFunctions([...functions, ''])} disabled={functions.length >= MAX_FUNCTIONS}>
                + Função
              </button>
            </div>
            <div className="row">
              <label className="field" style={{ width: '5.5rem' }}>
                Variável
                <input value={variable} onChange={(e) => setVariable(e.target.value.trim())} />
              </label>
              <label className="field grow">
                Mínimo
                <input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" />
              </label>
              <label className="field grow">
                Máximo
                <input value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" />
              </label>
            </div>
            <div className="row">
              <label className="field grow">
                Pontos
                <input value={samples} onChange={(e) => setSamples(e.target.value)} inputMode="numeric" />
              </label>
              <label className="check">
                <input type="checkbox" checked={logX} onChange={(e) => setLogX(e.target.checked)} /> log x
              </label>
              <label className="check">
                <input type="checkbox" checked={logY} onChange={(e) => setLogY(e.target.checked)} /> log y
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={useConstants} onChange={(e) => setUseConstants(e.target.checked)} /> Usar constantes físicas
            </label>
          </section>

          {detected.length > 0 && (
            <section className="card stack">
              <h3>Parâmetros</h3>
              {detected.map((s) => {
                const p = params[s] ?? defaultRange(1);
                const set = (patch: Partial<Param>) => setParams({ ...params, [s]: { ...p, ...patch } });
                return (
                  <div key={s} className="stack" style={{ gap: '0.25rem' }}>
                    <div className="row">
                      <span className="mono" style={{ minWidth: '3rem' }}>
                        {s}
                      </span>
                      <input
                        className="grow"
                        type="number"
                        value={p.value}
                        step="any"
                        onChange={(e) => Number.isFinite(e.target.valueAsNumber) && set({ value: e.target.valueAsNumber })}
                        aria-label={`Valor de ${s}`}
                      />
                    </div>
                    <input
                      type="range"
                      min={p.lo}
                      max={p.hi}
                      step="any"
                      value={p.value}
                      onChange={(e) => set({ value: Number(e.target.value) })}
                      aria-label={`Controle de ${s}`}
                    />
                    <div className="row range-row small muted">
                      <label className="field grow">
                        de
                        <input type="number" step="any" value={p.lo} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && set({ lo: e.target.valueAsNumber })} />
                      </label>
                      <label className="field grow">
                        até
                        <input type="number" step="any" value={p.hi} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && set({ hi: e.target.valueAsNumber })} />
                      </label>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          <section className="card stack">
            <h3>Exemplos</h3>
            <div className="chips">
              {PRESETS.map((p) => (
                <button key={p.label} className="chip" onClick={() => applyPreset(p)}>
                  {p.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="card">{computed.spec ? <Plot spec={computed.spec} logX={logX} logY={logY} height={440} /> : <div className="plot-loading">Sem dados para exibir.</div>}</section>
          <ResultPanel state={computed.state} />
          <div className="row">
            <button className="btn" onClick={record} disabled={!computed.spec}>
              Registrar no histórico
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
