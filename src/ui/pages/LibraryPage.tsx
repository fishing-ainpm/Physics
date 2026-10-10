import { useMemo, useRef, useState } from 'react';
import { splitEquation, toTex } from '../../core/math/engine';
import { AREAS, areaName } from '../../core/physics/areas';
import { FORMULA_CATALOG, type CatalogFormula } from '../../core/physics/formulas';
import type { SavedFormula } from '../../core/storage/stores';
import { useApp } from '../AppContext';
import { Tex } from '../components/Tex';

function formulaTex(expression: string): string | null {
  try {
    const eq = splitEquation(expression);
    return eq ? `${toTex(eq.lhs)} = ${toTex(eq.rhs)}` : toTex(expression);
  } catch {
    return null;
  }
}

export function LibraryPage() {
  const [tab, setTab] = useState<'minhas' | 'catalogo' | 'projetos'>('minhas');
  return (
    <>
      <header className="page-header">
        <h1>Biblioteca</h1>
        <p>Suas fórmulas salvas, organizadas por área, projeto e etiquetas, e um catálogo de fórmulas de referência documentadas.</p>
      </header>
      <div className="tabs" role="tablist">
        {(
          [
            ['minhas', 'Minhas fórmulas'],
            ['projetos', 'Projetos'],
            ['catalogo', 'Catálogo de referência'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'minhas' && <MyFormulas />}
      {tab === 'projetos' && <Projects />}
      {tab === 'catalogo' && <Catalog />}
    </>
  );
}

function MyFormulas() {
  const app = useApp();
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('');
  const [project, setProject] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  // libraryVersion força a releitura quando a biblioteca muda.
  const formulas = useMemo(() => app.library.formulas(), [app.library, app.libraryVersion]);
  const projects = useMemo(() => app.library.projects(), [app.library, app.libraryVersion]);
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name;

  const filtered = formulas.filter((f) => {
    if (area && f.area !== area) return false;
    if (project === '__none' ? f.projectId !== null : project && f.projectId !== project) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [f.name, f.expression, f.description, ...f.tags].some((s) => s.toLowerCase().includes(q));
  });

  function openInEditor(f: SavedFormula) {
    app.open('editor', {
      expression: f.expression,
      formulaId: f.id,
      name: f.name,
      area: f.area,
      description: f.description,
      tags: f.tags,
      projectId: f.projectId,
      units: f.variableUnits,
    });
  }

  function remove(f: SavedFormula) {
    if (!window.confirm(`Excluir a fórmula “${f.name}”?`)) return;
    app.library.removeFormula(f.id);
    app.libraryChanged();
    app.toast('Fórmula excluída.');
  }

  function duplicate(f: SavedFormula) {
    app.library.saveFormula({ ...f, id: undefined, name: `${f.name} (cópia)` });
    app.libraryChanged();
  }

  function exportFile() {
    const blob = new Blob([app.library.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `biblioteca-fisica-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(file: File) {
    try {
      const r = app.library.importJSON(await file.text());
      app.libraryChanged();
      app.toast(`Importados: ${r.formulas} fórmula(s) e ${r.projects} projeto(s).`);
    } catch (err) {
      app.toast((err as Error).message);
    }
  }

  return (
    <div className="stack">
      <section className="card row">
        <label className="field grow">
          Buscar
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="nome, expressão, etiqueta…" />
        </label>
        <label className="field grow">
          Área
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Todas</option>
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field grow">
          Projeto
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">Todos</option>
            <option value="__none">(sem projeto)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" onClick={() => app.open('editor', { expression: '' })}>
          + Nova fórmula
        </button>
        <button className="btn" onClick={exportFile} disabled={formulas.length === 0 && projects.length === 0}>
          Exportar JSON
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Importar JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importFile(f);
            e.target.value = '';
          }}
        />
      </section>

      {formulas.length === 0 ? (
        <section className="card">
          <p className="empty">Nenhuma fórmula salva. Crie uma no Editor ou salve uma fórmula do Catálogo de referência.</p>
        </section>
      ) : filtered.length === 0 ? (
        <section className="card">
          <p className="empty">Nenhuma fórmula corresponde aos filtros.</p>
        </section>
      ) : (
        <div className="list">
          {filtered.map((f) => {
            const tex = formulaTex(f.expression);
            return (
              <article className="item" key={f.id}>
                <div className="item-head">
                  <span className="item-title">{f.name}</span>
                  <span className="item-meta">
                    {areaName(f.area)}
                    {f.projectId && ` · ${projectName(f.projectId)}`} · atualizada em {new Date(f.updatedAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                {tex ? <Tex tex={tex} display /> : <code>{f.expression}</code>}
                {f.description && <p className="small muted" style={{ whiteSpace: 'pre-line' }}>{f.description}</p>}
                {f.tags.length > 0 && (
                  <div className="chips">
                    {f.tags.map((t) => (
                      <button key={t} className="tag" style={{ border: 0, cursor: 'pointer' }} onClick={() => setQuery(t)} title="Filtrar por etiqueta">
                        #{t}
                      </button>
                    ))}
                  </div>
                )}
                <div className="item-actions">
                  <button className="btn small primary" onClick={() => openInEditor(f)}>
                    Abrir no editor
                  </button>
                  <select
                    className="btn small"
                    style={{ width: 'auto' }}
                    value={f.projectId ?? ''}
                    aria-label="Mover para projeto"
                    onChange={(e) => {
                      app.library.saveFormula({ ...f, projectId: e.target.value || null });
                      app.libraryChanged();
                    }}
                  >
                    <option value="">(sem projeto)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button className="btn small" onClick={() => duplicate(f)}>
                    Duplicar
                  </button>
                  <button className="btn small danger" onClick={() => remove(f)}>
                    Excluir
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Projects() {
  const app = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const projects = useMemo(() => app.library.projects(), [app.library, app.libraryVersion]);
  const formulas = useMemo(() => app.library.formulas(), [app.library, app.libraryVersion]);

  function create() {
    try {
      app.library.saveProject({ name, description });
      setName('');
      setDescription('');
      app.libraryChanged();
    } catch (err) {
      app.toast((err as Error).message);
    }
  }

  return (
    <div className="grid grid-sidebar">
      <section className="card stack">
        <h3>Novo projeto</h3>
        <label className="field">
          Nome
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Buracos negros" />
        </label>
        <label className="field">
          Descrição
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ fontFamily: 'var(--sans)' }} />
        </label>
        <div className="row">
          <button className="btn primary" onClick={create} disabled={!name.trim()}>
            Criar projeto
          </button>
        </div>
      </section>
      <div className="list">
        {projects.length === 0 && (
          <section className="card">
            <p className="empty">Nenhum projeto. Projetos agrupam fórmulas relacionadas.</p>
          </section>
        )}
        {projects.map((p) => {
          const items = formulas.filter((f) => f.projectId === p.id);
          return (
            <article className="item" key={p.id}>
              {editing === p.id ? (
                <div className="stack">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} aria-label="Nome do projeto" />
                  <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} aria-label="Descrição do projeto" style={{ fontFamily: 'var(--sans)' }} />
                  <div className="row">
                    <button
                      className="btn small primary"
                      disabled={!editName.trim()}
                      onClick={() => {
                        app.library.saveProject({ id: p.id, name: editName, description: editDesc });
                        app.libraryChanged();
                        setEditing(null);
                      }}
                    >
                      Salvar
                    </button>
                    <button className="btn small" onClick={() => setEditing(null)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="item-head">
                    <span className="item-title">{p.name}</span>
                    <span className="item-meta">{items.length} fórmula(s)</span>
                  </div>
                  {p.description && <p className="small muted">{p.description}</p>}
                  {items.length > 0 && (
                    <ul className="small">
                      {items.map((f) => (
                        <li key={f.id}>
                          {f.name} — <code>{f.expression}</code>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="item-actions">
                    <button
                      className="btn small"
                      onClick={() => {
                        setEditing(p.id);
                        setEditName(p.name);
                        setEditDesc(p.description);
                      }}
                    >
                      Renomear / editar
                    </button>
                    <button
                      className="btn small danger"
                      onClick={() => {
                        if (!window.confirm(`Excluir o projeto “${p.name}”? As fórmulas serão mantidas, sem projeto.`)) return;
                        app.library.removeProject(p.id);
                        app.libraryChanged();
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Catalog() {
  const app = useApp();
  const [area, setArea] = useState<string>('');
  const [query, setQuery] = useState('');
  const list = FORMULA_CATALOG.filter((f) => (!area || f.area === area) && (!query.trim() || `${f.name} ${f.expression}`.toLowerCase().includes(query.trim().toLowerCase())));

  const units = (f: CatalogFormula) => Object.fromEntries(f.variables.filter((v) => v.unit).map((v) => [v.symbol, v.unit]));
  const description = (f: CatalogFormula) =>
    [`Hipóteses: ${f.assumptions.join('; ')}.`, `Limitações: ${f.limitations.join('; ')}.`, `Referência: ${f.reference}.`].join('\n');

  function save(f: CatalogFormula) {
    app.library.saveFormula({ name: f.name, expression: f.expression, area: f.area, description: description(f), tags: ['catálogo'], projectId: null, variableUnits: units(f) });
    app.libraryChanged();
    app.toast(`“${f.name}” salva em Minhas fórmulas.`);
  }

  return (
    <div className="stack">
      <section className="card row">
        <label className="field grow">
          Área
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Todas</option>
            {AREAS.filter((a) => FORMULA_CATALOG.some((f) => f.area === a.id)).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field grow">
          Buscar
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </section>
      <div className="list">
        {list.map((f) => (
          <article className="item" key={f.id}>
            <div className="item-head">
              <span className="item-title">{f.name}</span>
              <span className="item-meta">{areaName(f.area)}</span>
            </div>
            <Tex tex={f.tex} display />
            <div className="table-wrap">
              <table className="data small">
                <tbody>
                  {f.variables.map((v) => (
                    <tr key={v.symbol}>
                      <td className="mono">{v.symbol}</td>
                      <td>{v.description}</td>
                      <td className="mono muted">{v.unit || 'adimensional'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details className="doc">
              <summary>Hipóteses, limitações e referência</summary>
              <ul className="small">
                {f.assumptions.map((a) => (
                  <li key={a}>Hipótese: {a}</li>
                ))}
                {f.limitations.map((a) => (
                  <li key={a}>Limitação: {a}</li>
                ))}
                <li>Referência: {f.reference}</li>
              </ul>
            </details>
            <div className="item-actions">
              <button className="btn small primary" onClick={() => app.open('editor', { expression: f.expression, name: f.name, area: f.area, description: description(f), tags: ['catálogo'], units: units(f) })}>
                Usar no editor
              </button>
              <button className="btn small" onClick={() => save(f)}>
                Salvar na minha biblioteca
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
