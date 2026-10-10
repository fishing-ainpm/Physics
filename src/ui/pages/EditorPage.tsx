import { useEffect, useMemo, useRef, useState } from 'react';
import { MathError, evaluateExpression, splitEquation } from '../../core/math/engine';
import { AREAS, type AreaId } from '../../core/physics/areas';
import { CONSTANTS, constantsScope } from '../../core/physics/constants';
import { analyzeFormula, solveFormula } from '../../core/physics/formulaSolver';
import { checkEquationDimensions, siBaseText } from '../../core/units/units';
import { useApp } from '../AppContext';
import { ResultPanel, errorState, type ResultState } from '../components/ResultPanel';
import { Tex } from '../components/Tex';

const SNIPPETS: { label: string; insert: string; title: string }[] = [
  { label: 'x²', insert: '^2', title: 'Potência' },
  { label: '√', insert: 'sqrt()', title: 'Raiz quadrada' },
  { label: 'π', insert: 'pi', title: 'Pi' },
  { label: 'sin', insert: 'sin()', title: 'Seno (radianos)' },
  { label: 'cos', insert: 'cos()', title: 'Cosseno (radianos)' },
  { label: 'exp', insert: 'exp()', title: 'Exponencial' },
  { label: 'ln', insert: 'log()', title: 'Logaritmo natural' },
  { label: '|x|', insert: 'abs()', title: 'Valor absoluto' },
  { label: 'c', insert: 'c', title: 'Velocidade da luz' },
  { label: 'G', insert: 'G', title: 'Constante gravitacional' },
  { label: 'ħ', insert: 'hbar', title: 'Constante de Planck reduzida' },
  { label: 'k_B', insert: 'kB', title: 'Constante de Boltzmann' },
  { label: 'e', insert: 'qe', title: 'Carga elementar' },
  { label: 'ε₀', insert: 'eps0', title: 'Permissividade do vácuo' },
];

const CONST_BY_SYMBOL = new Map(CONSTANTS.map((k) => [k.symbol, k]));

/** Converte o texto de um campo (ex.: "1.5e-9", "2*pi", "0.5*c") em número. */
function readNumber(name: string, text: string): number {
  let r;
  try {
    r = evaluateExpression(text, constantsScope());
  } catch (err) {
    throw new MathError(`${name}: ${(err as Error).message}`);
  }
  if (r.number === undefined) throw new MathError(`${name}: informe um número real em SI (sem unidade).`);
  return r.number;
}

export function EditorPage() {
  const app = useApp();
  const [draft] = useState(() => app.peekDraft('editor'));
  useEffect(() => app.clearDraft('editor'), [app]);

  const [expression, setExpression] = useState(draft?.expression ?? 'E = m * c^2');
  const [values, setValues] = useState<Record<string, string>>(draft?.values ?? { m: '1' });
  const [units, setUnits] = useState<Record<string, string>>(draft?.units ?? { E: 'J', m: 'kg' });
  const [target, setTarget] = useState<string>(draft?.target ?? '');
  const [result, setResult] = useState<ResultState>({ kind: 'idle', message: 'Preencha os valores e clique em “Calcular”.' });
  const [formulaId, setFormulaId] = useState<string | undefined>(draft?.formulaId);
  const [name, setName] = useState(draft?.name ?? '');
  const [area, setArea] = useState<AreaId>(draft?.area ?? 'outra');
  const [description, setDescription] = useState(draft?.description ?? '');
  const [tags, setTags] = useState((draft?.tags ?? []).join(', '));
  const [projectId, setProjectId] = useState<string>(draft?.projectId ?? '');
  const [plotVar, setPlotVar] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  const analysis = useMemo(() => {
    try {
      return { ok: true as const, ...analyzeFormula(expression) };
    } catch (err) {
      return { ok: false as const, error: (err as Error).message };
    }
  }, [expression]);

  const variables = analysis.ok ? analysis.variables : [];
  const effectiveTarget = analysis.ok && analysis.isEquation ? (variables.includes(target) ? target : variables[0] ?? '') : '';
  const projects = app.library.projects();

  function insertSnippet(text: string) {
    const el = textRef.current;
    if (!el) return;
    const start = el.selectionStart ?? expression.length;
    const end = el.selectionEnd ?? expression.length;
    const next = expression.slice(0, start) + text + expression.slice(end);
    setExpression(next);
    const caret = start + (text.endsWith('()') ? text.length - 1 : text.length);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  function collectValues(skip: string | null): Record<string, number> {
    const out: Record<string, number> = {};
    const missing: string[] = [];
    for (const v of variables) {
      if (v === skip) continue;
      const text = (values[v] ?? '').trim();
      if (!text) {
        missing.push(v);
        continue;
      }
      out[v] = readNumber(v, text);
    }
    if (missing.length) throw new MathError(`Informe valores para: ${missing.join(', ')}.`);
    return out;
  }

  function calculate() {
    try {
      if (!analysis.ok) throw new MathError(analysis.error);
      const tgt = analysis.isEquation ? effectiveTarget : null;
      const vals = collectValues(tgt);
      const r = solveFormula(expression, tgt, vals);
      const unit = tgt ? units[tgt]?.trim() : '';
      const label = tgt ?? 'Resultado';
      const lines = r.texts.map((t) => `${label} = ${t}${unit ? ` ${unit}` : ''}`);
      setResult({
        kind: 'ok',
        title: `Resultado (${r.method})`,
        lines,
        notes: [...r.notes, 'Valores interpretados em unidades SI.'],
      });
      app.addHistory({
        kind: 'fórmula',
        input: `${expression}  |  ${Object.entries(vals).map(([k, v]) => `${k}=${v}`).join(', ')}`,
        output: lines.join('; '),
        ok: true,
        payload: { expression, values, units, target: tgt ?? '' },
      });
    } catch (err) {
      setResult(errorState(err, 'Erro no cálculo'));
      app.addHistory({ kind: 'fórmula', input: expression, output: (err as Error).message, ok: false, payload: { expression, values, units, target } });
    }
  }

  function checkDims() {
    try {
      if (!analysis.ok) throw new MathError(analysis.error);
      if (!analysis.isEquation) throw new MathError('A verificação dimensional requer uma equação com "=".');
      const map: Record<string, string> = {};
      for (const s of analysis.constants) map[s] = CONST_BY_SYMBOL.get(s)!.unit;
      for (const v of variables) map[v] = units[v] ?? '';
      const r = checkEquationDimensions(expression, map);
      setResult({
        kind: r.consistent ? 'ok' : 'warn',
        title: r.consistent ? 'Dimensões consistentes' : 'Dimensões inconsistentes',
        text: r.message,
        lines: [`Esquerda: ${siBaseText(r.lhs.dimensions) || 'adimensional'}`, `Direita: ${siBaseText(r.rhs.dimensions) || 'adimensional'}`],
        notes: ['Variáveis sem unidade são tratadas como adimensionais.'],
      });
      app.addHistory({ kind: 'dimensões', input: `${expression} [${Object.entries(map).map(([k, u]) => `${k}: ${u || '1'}`).join(', ')}]`, output: r.message, ok: true });
    } catch (err) {
      setResult(errorState(err, 'Erro na análise dimensional'));
    }
  }

  function sendToGraph() {
    try {
      if (!analysis.ok) throw new MathError(analysis.error);
      const eq = splitEquation(expression);
      let fn = expression;
      let lhsVar: string | null = null;
      if (eq) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(eq.lhs)) throw new MathError('Para plotar, escreva a equação na forma "y = expressão".');
        fn = eq.rhs;
        lhsVar = eq.lhs;
      }
      const candidates = variables.filter((v) => v !== lhsVar);
      const xVar = candidates.includes(plotVar) ? plotVar : candidates[0];
      if (!xVar) throw new MathError('A expressão não tem variável para o eixo x.');
      const params: Record<string, number> = {};
      for (const v of candidates) {
        if (v === xVar) continue;
        const text = (values[v] ?? '').trim();
        params[v] = text ? readNumber(v, text) : 1;
      }
      app.open('graficos', { functions: [fn], variable: xVar, params });
    } catch (err) {
      setResult(errorState(err, 'Não foi possível enviar ao gráfico'));
    }
  }

  function save(asNew: boolean) {
    try {
      const saved = app.library.saveFormula({
        id: asNew ? undefined : formulaId,
        name,
        expression,
        area,
        description,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        projectId: projectId || null,
        variableUnits: Object.fromEntries(variables.filter((v) => units[v]).map((v) => [v, units[v]])),
      });
      setFormulaId(saved.id);
      app.libraryChanged();
      app.toast(asNew || !formulaId ? 'Fórmula salva na biblioteca.' : 'Fórmula atualizada.');
    } catch (err) {
      setResult(errorState(err, 'Erro ao salvar'));
    }
  }

  return (
    <>
      <header className="page-header">
        <h1>Editor de fórmulas</h1>
        <p>
          Escreva uma expressão ou equação (sintaxe do <a href="https://mathjs.org/docs/expressions/syntax.html" target="_blank" rel="noreferrer">mathjs</a>
          ). Constantes físicas como <code>c</code>, <code>G</code>, <code>hbar</code>, <code>kB</code>, <code>qe</code> são reconhecidas automaticamente.
        </p>
      </header>

      <div className="grid grid-2">
        <div className="stack">
          <section className="card stack">
            <label className="field">
              Fórmula
              <textarea
                ref={textRef}
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                spellCheck={false}
                rows={3}
                aria-describedby="preview"
              />
            </label>
            <div className="chips" aria-label="Inserir símbolos">
              {SNIPPETS.map((s) => (
                <button key={s.label} type="button" className="chip" title={s.title} onClick={() => insertSnippet(s.insert)}>
                  {s.label}
                </button>
              ))}
            </div>
            <div id="preview" className="tex-preview" aria-live="polite">
              {analysis.ok ? <Tex tex={analysis.tex} display /> : <span className="err-text small">{analysis.error}</span>}
            </div>
          </section>

          <section className="card stack">
            <h3>Variáveis</h3>
            {variables.length === 0 ? (
              <p className="empty">Nenhuma variável livre.</p>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      {analysis.ok && analysis.isEquation && <th>Calcular</th>}
                      <th>Símbolo</th>
                      <th>Valor (SI)</th>
                      <th>Unidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variables.map((v) => (
                      <tr key={v}>
                        {analysis.ok && analysis.isEquation && (
                          <td>
                            <input type="radio" name="target" aria-label={`Calcular ${v}`} checked={effectiveTarget === v} onChange={() => setTarget(v)} />
                          </td>
                        )}
                        <td className="mono">{v}</td>
                        <td>
                          <input
                            value={effectiveTarget === v ? '' : values[v] ?? ''}
                            disabled={effectiveTarget === v}
                            placeholder={effectiveTarget === v ? '(incógnita)' : 'ex.: 1.5e-3'}
                            onChange={(e) => setValues({ ...values, [v]: e.target.value })}
                            aria-label={`Valor de ${v}`}
                          />
                        </td>
                        <td>
                          <input value={units[v] ?? ''} placeholder="ex.: kg" onChange={(e) => setUnits({ ...units, [v]: e.target.value })} aria-label={`Unidade de ${v}`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {analysis.ok && analysis.constants.length > 0 && (
              <div className="small muted">
                Constantes usadas:{' '}
                {analysis.constants.map((s) => {
                  const k = CONST_BY_SYMBOL.get(s)!;
                  return (
                    <span key={s} title={`${k.name} (${k.source})`} style={{ marginRight: '0.8rem' }}>
                      <Tex tex={k.tex} /> = <span className="mono">{k.value.toPrecision(10)}</span> {k.unit}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="row">
              <button className="btn primary" onClick={calculate} disabled={!analysis.ok}>
                Calcular
              </button>
              <button className="btn" onClick={checkDims} disabled={!analysis.ok || !analysis.isEquation}>
                Verificar dimensões
              </button>
              <span className="spacer" />
              {variables.length > 1 && (
                <select value={plotVar} onChange={(e) => setPlotVar(e.target.value)} aria-label="Variável do eixo x" style={{ width: 'auto' }}>
                  <option value="">eixo x: automático</option>
                  {variables.map((v) => (
                    <option key={v} value={v}>
                      eixo x: {v}
                    </option>
                  ))}
                </select>
              )}
              <button className="btn" onClick={sendToGraph} disabled={!analysis.ok}>
                Plotar
              </button>
            </div>
          </section>
        </div>

        <div className="stack">
          <ResultPanel state={result} />
          <section className="card stack">
            <h3>{formulaId ? 'Editar na biblioteca' : 'Salvar na biblioteca'}</h3>
            <label className="field">
              Nome
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Energia de repouso" />
            </label>
            <div className="row">
              <label className="field grow">
                Área
                <select value={area} onChange={(e) => setArea(e.target.value as AreaId)}>
                  {AREAS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field grow">
                Projeto
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">(sem projeto)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              Descrição, hipóteses e limitações
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ fontFamily: 'var(--sans)' }} />
            </label>
            <label className="field">
              Etiquetas (separadas por vírgula)
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ex.: energia, relatividade restrita" />
            </label>
            <div className="row">
              <button className="btn primary" onClick={() => save(false)} disabled={!name.trim() || !analysis.ok}>
                {formulaId ? 'Atualizar' : 'Salvar'}
              </button>
              {formulaId && (
                <button className="btn" onClick={() => save(true)} disabled={!name.trim() || !analysis.ok}>
                  Salvar como nova
                </button>
              )}
              {formulaId && (
                <button className="btn" onClick={() => setFormulaId(undefined)}>
                  Desvincular
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
