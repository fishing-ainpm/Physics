import { useMemo, useState } from 'react';
import { freeSymbols, splitEquation } from '../../core/math/engine';
import { CONSTANTS } from '../../core/physics/constants';
import { UNIT_GROUPS, analyzeDimensions, checkEquationDimensions, convertUnit, siBaseText } from '../../core/units/units';
import { useApp } from '../AppContext';
import { ResultPanel, errorState, type ResultState } from '../components/ResultPanel';
import { Tex } from '../components/Tex';

const ALL_UNITS = [...new Set(UNIT_GROUPS.flatMap((g) => g.units))];

export function UnitsPage() {
  const app = useApp();
  const [tab, setTab] = useState<'converter' | 'dimensoes' | 'equacao' | 'constantes'>('converter');
  return (
    <>
      <header className="page-header">
        <h1>Unidades e dimensões</h1>
        <p>Converta unidades, descubra a dimensão de uma expressão e verifique a consistência dimensional de equações.</p>
      </header>
      <div className="tabs" role="tablist">
        {(
          [
            ['converter', 'Conversão'],
            ['dimensoes', 'Análise dimensional'],
            ['equacao', 'Verificar equação'],
            ['constantes', 'Constantes físicas'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'converter' && <Converter addHistory={app.addHistory} />}
      {tab === 'dimensoes' && <Dimensions addHistory={app.addHistory} />}
      {tab === 'equacao' && <EquationCheck addHistory={app.addHistory} />}
      {tab === 'constantes' && <ConstantsTable />}
      <datalist id="unit-list">
        {ALL_UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </>
  );
}

type AddHistory = ReturnType<typeof useApp>['addHistory'];

function Converter({ addHistory }: { addHistory: AddHistory }) {
  const [value, setValue] = useState('1');
  const [from, setFrom] = useState('eV');
  const [to, setTo] = useState('J');
  const [group, setGroup] = useState(UNIT_GROUPS.find((g) => g.name === 'Energia')!.name);
  const [state, setState] = useState<ResultState>({ kind: 'idle' });

  function convert() {
    const input = `${value} ${from} → ${to}`;
    try {
      const v = Number(value.replace(',', '.'));
      if (value.trim() === '' || !Number.isFinite(v)) throw new Error('Informe um valor numérico.');
      const r = convertUnit(v, from, to);
      setState({
        kind: 'ok',
        title: 'Conversão',
        text: `${value} ${from} = ${r.text}`,
        notes: r.factor !== undefined ? [`Fator: 1 ${from} = ${r.factor.toPrecision(12)} ${to}`] : ['Escala com deslocamento (não é um fator simples).'],
      });
      addHistory({ kind: 'conversão', input, output: r.text, ok: true });
    } catch (err) {
      setState(errorState(err));
      addHistory({ kind: 'conversão', input, output: (err as Error).message, ok: false });
    }
  }

  const units = UNIT_GROUPS.find((g) => g.name === group)?.units ?? [];

  return (
    <div className="grid grid-2">
      <section className="card stack">
        <label className="field">
          Grandeza (sugestões)
          <select
            value={group}
            onChange={(e) => {
              const g = UNIT_GROUPS.find((x) => x.name === e.target.value)!;
              setGroup(g.name);
              setFrom(g.units[0]);
              setTo(g.units[1] ?? g.units[0]);
            }}
          >
            {UNIT_GROUPS.map((g) => (
              <option key={g.name}>{g.name}</option>
            ))}
          </select>
        </label>
        <div className="row">
          <label className="field grow">
            Valor
            <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" />
          </label>
          <label className="field grow">
            De
            <input value={from} onChange={(e) => setFrom(e.target.value)} list="unit-list" spellCheck={false} />
          </label>
          <button className="btn" onClick={() => (setFrom(to), setTo(from))} aria-label="Inverter unidades" title="Inverter">
            ⇄
          </button>
          <label className="field grow">
            Para
            <input value={to} onChange={(e) => setTo(e.target.value)} list="unit-list" spellCheck={false} />
          </label>
        </div>
        <div className="chips">
          {units.map((u) => (
            <button key={u} className="chip" onClick={() => setTo(u)} title={`Converter para ${u}`}>
              {u}
            </button>
          ))}
        </div>
        <p className="small muted">
          Qualquer unidade do mathjs pode ser digitada, inclusive compostas (ex.: <code>kg*m/s^2</code>, <code>km/h</code>). Prefixos SI são aceitos (MeV, nm, µs → us).
        </p>
        <div className="row">
          <button className="btn primary" onClick={convert}>
            Converter
          </button>
        </div>
      </section>
      <ResultPanel state={state} />
    </div>
  );
}

function Dimensions({ addHistory }: { addHistory: AddHistory }) {
  const [expr, setExpr] = useState('0.5 * 2 kg * (3 m/s)^2');
  const [state, setState] = useState<ResultState>({ kind: 'idle' });
  function run() {
    try {
      const r = analyzeDimensions(expr);
      setState({
        kind: 'ok',
        title: 'Análise dimensional',
        text: r.valueText,
        lines: [`Em unidades SI de base: ${r.siText || 'adimensional'}`, `Dimensão: ${r.dimensionText}`],
        notes: r.matches.length ? [`Compatível com: ${r.matches.map((m) => `${m.unit} (${m.quantity})`).join(', ')}`] : [],
      });
      addHistory({ kind: 'dimensões', input: expr, output: `${r.valueText} — ${r.dimensionText}`, ok: true });
    } catch (err) {
      setState(errorState(err));
      addHistory({ kind: 'dimensões', input: expr, output: (err as Error).message, ok: false });
    }
  }
  return (
    <div className="grid grid-2">
      <section className="card stack">
        <label className="field">
          Expressão com unidades
          <textarea value={expr} onChange={(e) => setExpr(e.target.value)} rows={2} spellCheck={false} />
        </label>
        <div className="chips">
          {['6.674e-11 N*m^2/kg^2 * 5.97e24 kg / (6.371e6 m)^2', '1.055e-34 J*s / (9.11e-31 kg * 1e-10 m)', '8.617e-5 eV/K * 300 K', '1 T * 1 C * 1 m/s'].map((e) => (
            <button key={e} className="chip" onClick={() => setExpr(e)}>
              {e}
            </button>
          ))}
        </div>
        <div className="row">
          <button className="btn primary" onClick={run}>
            Analisar
          </button>
        </div>
        <p className="small muted">Dimensões: M massa, L comprimento, T tempo, I corrente, Θ temperatura, N quantidade de substância, J intensidade luminosa. O radiano é tratado como adimensional (SI).</p>
      </section>
      <ResultPanel state={state} />
    </div>
  );
}

function EquationCheck({ addHistory }: { addHistory: AddHistory }) {
  const [equation, setEquation] = useState('F = G * m1 * m2 / r^2');
  const [units, setUnits] = useState<Record<string, string>>({ F: 'N', m1: 'kg', m2: 'kg', r: 'm' });
  const [state, setState] = useState<ResultState>({ kind: 'idle' });
  const constUnits = useMemo(() => Object.fromEntries(CONSTANTS.map((k) => [k.symbol, k.unit])), []);

  const symbols = useMemo(() => {
    try {
      const eq = splitEquation(equation);
      if (!eq) return [];
      return [...new Set([...freeSymbols(eq.lhs), ...freeSymbols(eq.rhs)])];
    } catch {
      return [];
    }
  }, [equation]);

  function run() {
    try {
      const map: Record<string, string> = {};
      for (const s of symbols) map[s] = units[s] ?? (s in constUnits ? constUnits[s] : '');
      const r = checkEquationDimensions(equation, map);
      setState({
        kind: r.consistent ? 'ok' : 'warn',
        title: r.consistent ? 'Consistente' : 'Inconsistente',
        text: r.message,
        lines: [`Esquerda: ${siBaseText(r.lhs.dimensions) || 'adimensional'}`, `Direita: ${siBaseText(r.rhs.dimensions) || 'adimensional'}`],
      });
      addHistory({ kind: 'dimensões', input: equation, output: r.message, ok: true });
    } catch (err) {
      setState(errorState(err));
      addHistory({ kind: 'dimensões', input: equation, output: (err as Error).message, ok: false });
    }
  }

  return (
    <div className="grid grid-2">
      <section className="card stack">
        <label className="field">
          Equação
          <input value={equation} onChange={(e) => setEquation(e.target.value)} spellCheck={false} className="mono" />
        </label>
        {symbols.length > 0 ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Símbolo</th>
                  <th>Unidade (vazio = adimensional)</th>
                </tr>
              </thead>
              <tbody>
                {symbols.map((s) => (
                  <tr key={s}>
                    <td className="mono">{s}</td>
                    <td>
                      <input
                        value={units[s] ?? (s in constUnits ? constUnits[s] : '')}
                        onChange={(e) => setUnits({ ...units, [s]: e.target.value })}
                        list="unit-list"
                        aria-label={`Unidade de ${s}`}
                        spellCheck={false}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">Escreva uma equação com “=”.</p>
        )}
        <p className="small muted">Constantes conhecidas (c, G, hbar, ...) recebem a unidade SI automaticamente.</p>
        <div className="row">
          <button className="btn primary" onClick={run} disabled={symbols.length === 0}>
            Verificar
          </button>
        </div>
      </section>
      <ResultPanel state={state} />
    </div>
  );
}

function ConstantsTable() {
  return (
    <section className="card">
      <p className="small muted">Valores SI usados em todas as ferramentas. Fonte principal: CODATA 2018 (NIST). Use o símbolo da coluna “Expressão” nas fórmulas.</p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Símbolo</th>
              <th>Expressão</th>
              <th>Nome</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
              <th>Unidade</th>
              <th>Incerteza relativa</th>
              <th>Fonte</th>
            </tr>
          </thead>
          <tbody>
            {CONSTANTS.map((k) => (
              <tr key={k.symbol}>
                <td>
                  <Tex tex={k.tex} />
                </td>
                <td className="mono">{k.symbol}</td>
                <td>{k.name}</td>
                <td className="num">{k.value.toPrecision(11).replace(/\.?0+(e|$)/, '$1')}</td>
                <td className="mono small">{k.unit || '—'}</td>
                <td className="small">{k.relUncertainty === 0 ? 'exato' : k.relUncertainty.toExponential(1)}</td>
                <td className="small muted">{k.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
