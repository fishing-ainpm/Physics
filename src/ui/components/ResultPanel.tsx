import type { ReactNode } from 'react';
import { Tex } from './Tex';

export type ResultState =
  | { kind: 'idle'; message?: string }
  | { kind: 'ok' | 'warn'; title: string; tex?: string; text?: string; lines?: string[]; notes?: string[]; extra?: ReactNode }
  | { kind: 'error'; title?: string; message: string };

/** Painel padrão de resultados e erros, usado por todas as ferramentas. */
export function ResultPanel({ state }: { state: ResultState }) {
  if (state.kind === 'idle') {
    return (
      <div className="result" role="status">
        <div className="result-title">Resultado</div>
        <div className="empty">{state.message ?? 'Nenhum cálculo realizado ainda.'}</div>
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <div className="result error" role="alert">
        <div className="result-title">{state.title ?? 'Erro'}</div>
        <div>{state.message}</div>
      </div>
    );
  }
  return (
    <div className={`result ${state.kind}`} role="status">
      <div className="result-title">{state.title}</div>
      {state.tex && <Tex tex={state.tex} display />}
      {state.text && <div className="big-value">{state.text}</div>}
      {state.lines && state.lines.length > 0 && (
        <ul>
          {state.lines.map((l, i) => (
            <li key={i} className="mono">
              {l}
            </li>
          ))}
        </ul>
      )}
      {state.extra}
      {state.notes && state.notes.length > 0 && (
        <div className="notes">
          {state.notes.map((n, i) => (
            <div key={i}>• {n}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function errorState(err: unknown, title?: string): ResultState {
  return { kind: 'error', title, message: err instanceof Error ? err.message : String(err) };
}
