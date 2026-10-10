import { useCallback, useEffect, useState } from 'react';
import { formatValue } from '../../core/math/engine';
import { AREAS, areaName } from '../../core/physics/areas';
import { SIMULATIONS, defaultParams, getSimulation, runSimulation, type SimulationResult } from '../../core/simulations';
import { useApp } from '../AppContext';
import { Plot } from '../components/Plot';
import { ResultPanel, errorState, type ResultState } from '../components/ResultPanel';
import { Tex } from '../components/Tex';

function fmt(v: number): string {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e-3 && a < 1e6) return Number(v.toPrecision(6)).toLocaleString('pt-BR', { maximumSignificantDigits: 6, useGrouping: false });
  return formatValue(v, 6).text;
}

export function SimulationsPage() {
  const app = useApp();
  const [draft] = useState(() => app.peekDraft('simulacoes'));
  useEffect(() => app.clearDraft('simulacoes'), [app]);

  const initial = (draft && getSimulation(draft.id)) || SIMULATIONS[0];
  const [modelId, setModelId] = useState(initial.id);
  const model = getSimulation(modelId)!;
  const [values, setValues] = useState<Record<string, string>>(() => {
    const p = { ...defaultParams(initial), ...(draft?.params ?? {}) };
    return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)]));
  });
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [status, setStatus] = useState<ResultState>({ kind: 'idle', message: 'Ajuste os parâmetros e clique em “Executar”.' });
  const [running, setRunning] = useState(false);

  const execute = useCallback(
    (record: boolean, vals: Record<string, string>, id: string) => {
      const m = getSimulation(id)!;
      setRunning(true);
      // Deixa a interface atualizar o estado "executando" antes do cálculo.
      window.setTimeout(() => {
        const params = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, v.trim() === '' ? NaN : Number(v.replace(',', '.'))]));
        const t0 = performance.now();
        try {
          const r = runSimulation(m, params);
          const ms = performance.now() - t0;
          setResult(r);
          setStatus(
            r.warnings.length
              ? { kind: 'warn', title: 'Simulação concluída com avisos', lines: r.warnings, notes: [`Tempo de cálculo: ${ms.toFixed(0)} ms`] }
              : { kind: 'ok', title: 'Simulação concluída', notes: [`Tempo de cálculo: ${ms.toFixed(0)} ms`] },
          );
          if (record) {
            app.addHistory({
              kind: 'simulação',
              input: `${m.name}: ${m.parameters.map((p) => `${p.key}=${params[p.key]}`).join(', ')}`,
              output: r.summary.slice(0, 4).map((s) => `${s.label} = ${fmt(s.value)} ${s.unit}`).join('; '),
              ok: true,
              payload: { id: m.id, params },
            });
          }
        } catch (err) {
          setResult(null);
          setStatus(errorState(err, 'Erro na simulação'));
          if (record) app.addHistory({ kind: 'simulação', input: m.name, output: (err as Error).message, ok: false, payload: { id: m.id, params } });
        } finally {
          setRunning(false);
        }
      }, 10);
    },
    [app],
  );

  // Executa uma vez ao abrir para mostrar o modelo com os valores padrão.
  useEffect(() => {
    execute(false, values, modelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectModel(id: string) {
    const m = getSimulation(id)!;
    const vals = Object.fromEntries(Object.entries(defaultParams(m)).map(([k, v]) => [k, String(v)]));
    setModelId(id);
    setValues(vals);
    setResult(null);
    execute(false, vals, id);
  }

  function reset() {
    const vals = Object.fromEntries(Object.entries(defaultParams(model)).map(([k, v]) => [k, String(v)]));
    setValues(vals);
    execute(false, vals, modelId);
  }

  return (
    <>
      <header className="page-header">
        <h1>Simulações físicas</h1>
        <p>Modelos numéricos e analíticos com parâmetros ajustáveis. Cada modelo documenta equações, método, hipóteses e limitações.</p>
      </header>
      <div className="grid grid-sidebar">
        <div className="stack">
          <section className="card stack">
            <label className="field">
              Modelo
              <select value={modelId} onChange={(e) => selectModel(e.target.value)}>
                {AREAS.filter((a) => SIMULATIONS.some((s) => s.area === a.id)).map((a) => (
                  <optgroup key={a.id} label={a.name}>
                    {SIMULATIONS.filter((s) => s.area === a.id).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <p className="small muted">{model.description}</p>
          </section>
          <section className="card stack">
            <h3>Parâmetros</h3>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                execute(true, values, modelId);
              }}
            >
              {model.parameters.map((p) => {
                const num = Number(values[p.key]);
                return (
                  <div key={p.key} className="stack" style={{ gap: '0.2rem' }}>
                    <label className="field">
                      <span>
                        {p.label} {p.unit && <span className="muted">({p.unit})</span>}
                      </span>
                      <input
                        value={values[p.key] ?? ''}
                        inputMode="decimal"
                        onChange={(e) => setValues({ ...values, [p.key]: e.target.value })}
                        aria-invalid={!Number.isFinite(num) || num < p.min || num > p.max}
                      />
                      {p.help && <span className="hint">{p.help}</span>}
                    </label>
                    <input
                      type="range"
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      value={Number.isFinite(num) ? Math.min(Math.max(num, p.min), p.max) : p.default}
                      onChange={(e) => setValues({ ...values, [p.key]: e.target.value })}
                      aria-label={`${p.label} (controle deslizante)`}
                    />
                  </div>
                );
              })}
              <div className="row">
                <button className="btn primary" type="submit" disabled={running}>
                  {running ? 'Executando…' : 'Executar'}
                </button>
                <button className="btn" type="button" onClick={reset} disabled={running}>
                  Restaurar padrões
                </button>
              </div>
            </form>
          </section>
          <section className="card stack">
            <h3>Documentação do modelo</h3>
            <div className="small muted">Área: {areaName(model.area)}</div>
            {model.equations.map((eq, i) => (
              <Tex key={i} tex={eq} display />
            ))}
            <details className="doc" open>
              <summary>Método numérico</summary>
              <p className="small muted">{model.method}</p>
            </details>
            <details className="doc">
              <summary>Hipóteses</summary>
              <ul className="small">
                {model.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </details>
            <details className="doc">
              <summary>Limitações</summary>
              <ul className="small">
                {model.limitations.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </details>
            <details className="doc">
              <summary>Referências</summary>
              <ul className="small">
                {model.references.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </details>
          </section>
        </div>

        <div className="stack">
          <ResultPanel state={status} />
          {result && (
            <section className="card">
              <h3>Resultados</h3>
              <div className="table-wrap">
                <table className="data">
                  <tbody>
                    {result.summary.map((s) => (
                      <tr key={s.label}>
                        <td>{s.label}</td>
                        <td className="num">{fmt(s.value)}</td>
                        <td className="muted">{s.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {result?.plots.map((p) => (
            <section className="card" key={p.title}>
              <Plot spec={p} />
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
