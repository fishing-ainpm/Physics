import { useMemo, useState } from 'react';
import type { HistoryEntry, HistoryKind } from '../../core/storage/stores';
import { type CalcMode, useApp } from '../AppContext';

const KINDS: HistoryKind[] = ['avaliar', 'simplificar', 'derivar', 'resolver', 'integrar', 'fórmula', 'conversão', 'dimensões', 'simulação', 'gráfico'];
const CALC_KINDS = new Set<string>(['avaliar', 'simplificar', 'derivar', 'resolver', 'integrar']);

export function HistoryPage() {
  const app = useApp();
  const [kind, setKind] = useState('');
  const [query, setQuery] = useState('');
  const [onlyErrors, setOnlyErrors] = useState(false);
  const entries = useMemo(() => app.history.list(), [app.history, app.historyVersion]);

  const filtered = entries.filter(
    (e) => (!kind || e.kind === kind) && (!onlyErrors || !e.ok) && (!query.trim() || `${e.input} ${e.output}`.toLowerCase().includes(query.trim().toLowerCase())),
  );

  function canReopen(e: HistoryEntry) {
    return !!e.payload && (CALC_KINDS.has(e.kind) || e.kind === 'fórmula' || e.kind === 'simulação' || e.kind === 'gráfico');
  }

  function reopen(e: HistoryEntry) {
    const p = e.payload as Record<string, unknown>;
    if (CALC_KINDS.has(e.kind)) {
      app.open('calculadora', {
        mode: e.kind as CalcMode,
        expression: String(p.expression ?? ''),
        variable: typeof p.variable === 'string' ? p.variable : undefined,
        min: typeof p.min === 'string' ? p.min : undefined,
        max: typeof p.max === 'string' ? p.max : undefined,
        params: typeof p.params === 'string' ? p.params : undefined,
        useConstants: typeof p.useConstants === 'boolean' ? p.useConstants : undefined,
      });
    } else if (e.kind === 'fórmula') {
      app.open('editor', {
        expression: String(p.expression ?? ''),
        values: (p.values as Record<string, string>) ?? {},
        units: (p.units as Record<string, string>) ?? {},
        target: typeof p.target === 'string' ? p.target : undefined,
      });
    } else if (e.kind === 'simulação') {
      app.open('simulacoes', { id: String(p.id), params: (p.params as Record<string, number>) ?? {} });
    } else if (e.kind === 'gráfico') {
      app.open('graficos', {
        functions: Array.isArray(p.functions) ? (p.functions as string[]) : [],
        variable: typeof p.variable === 'string' ? p.variable : undefined,
        min: typeof p.min === 'number' ? p.min : undefined,
        max: typeof p.max === 'number' ? p.max : undefined,
        params: (p.params as Record<string, number>) ?? {},
      });
    }
  }

  async function copy(e: HistoryEntry) {
    try {
      await navigator.clipboard.writeText(`${e.input}\n→ ${e.output}`);
      app.toast('Copiado para a área de transferência.');
    } catch {
      app.toast('Não foi possível copiar (permissão negada pelo navegador).');
    }
  }

  return (
    <>
      <header className="page-header">
        <h1>Histórico</h1>
        <p>Registro dos cálculos, conversões, simulações e gráficos realizados neste navegador (até 300 entradas).</p>
      </header>
      <div className="stack">
        <section className="card row">
          <label className="field grow">
            Buscar
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label className="field grow">
            Tipo
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">Todos</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} /> Só erros
          </label>
          <button
            className="btn danger"
            disabled={entries.length === 0}
            onClick={() => {
              if (!window.confirm('Apagar todo o histórico?')) return;
              app.history.clear();
              app.historyChanged();
            }}
          >
            Limpar histórico
          </button>
        </section>
        {filtered.length === 0 ? (
          <section className="card">
            <p className="empty">{entries.length === 0 ? 'O histórico está vazio.' : 'Nenhuma entrada corresponde aos filtros.'}</p>
          </section>
        ) : (
          <div className="list">
            {filtered.map((e) => (
              <article className="item" key={e.id}>
                <div className="item-head">
                  <span className="tag">{e.kind}</span>
                  <span className={e.ok ? 'ok-text small' : 'err-text small'}>{e.ok ? '✓ sucesso' : '✕ erro'}</span>
                  <span className="item-meta">{new Date(e.timestamp).toLocaleString('pt-BR')}</span>
                </div>
                <div className="mono small" style={{ wordBreak: 'break-word', marginTop: '0.3rem' }}>
                  {e.input}
                </div>
                <div className={`mono small ${e.ok ? '' : 'err-text'}`} style={{ wordBreak: 'break-word' }}>
                  → {e.output}
                </div>
                <div className="item-actions">
                  {canReopen(e) && (
                    <button className="btn small primary" onClick={() => reopen(e)}>
                      Reabrir
                    </button>
                  )}
                  <button className="btn small" onClick={() => copy(e)}>
                    Copiar
                  </button>
                  <button
                    className="btn small danger"
                    onClick={() => {
                      app.history.remove(e.id);
                      app.historyChanged();
                    }}
                  >
                    Remover
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
