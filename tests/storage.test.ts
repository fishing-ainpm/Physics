import { describe, expect, it } from 'vitest';
import { HistoryStore, LibraryStore, MemoryStorage } from '../src/core/storage/stores';

const formula = { name: 'Energia', expression: 'E = m*c^2', area: 'relatividade' as const, description: '', tags: ['energia'], projectId: null, variableUnits: { E: 'J' } };

describe('biblioteca', () => {
  it('salva, edita, persiste e remove', () => {
    const storage = new MemoryStorage();
    const lib = new LibraryStore(storage);
    const f = lib.saveFormula(formula);
    lib.saveFormula({ ...f, name: 'Energia de repouso' });
    const reloaded = new LibraryStore(storage);
    expect(reloaded.formulas()).toHaveLength(1);
    expect(reloaded.formulas()[0].name).toBe('Energia de repouso');
    reloaded.removeFormula(f.id);
    expect(new LibraryStore(storage).formulas()).toHaveLength(0);
  });
  it('projetos: remover projeto não apaga fórmulas', () => {
    const lib = new LibraryStore(new MemoryStorage());
    const p = lib.saveProject({ name: 'Relatividade restrita' });
    const f = lib.saveFormula({ ...formula, projectId: p.id });
    lib.removeProject(p.id);
    expect(lib.getFormula(f.id)?.projectId).toBeNull();
  });
  it('rejeita fórmula sem nome', () => {
    const lib = new LibraryStore(new MemoryStorage());
    expect(() => lib.saveFormula({ ...formula, name: ' ' })).toThrow();
  });
  it('exporta e importa JSON', () => {
    const a = new LibraryStore(new MemoryStorage());
    a.saveProject({ name: 'P' });
    a.saveFormula(formula);
    const b = new LibraryStore(new MemoryStorage());
    expect(b.importJSON(a.exportJSON())).toEqual({ formulas: 1, projects: 1 });
    expect(() => b.importJSON('não json')).toThrow(/JSON/);
    expect(() => b.importJSON('{}')).toThrow(/Nenhuma/);
  });
  it('recupera de dados corrompidos', () => {
    const s = new MemoryStorage();
    s.setItem('tpw.library.v1', '{corrompido');
    const lib = new LibraryStore(s);
    expect(lib.formulas()).toEqual([]);
    expect(lib.loadWarning).toMatch(/corrompidos/);
  });
});

describe('histórico', () => {
  it('registra em ordem reversa e limita o tamanho', () => {
    const h = new HistoryStore(new MemoryStorage());
    for (let i = 0; i < HistoryStore.MAX + 5; i++) h.add({ kind: 'avaliar', input: `${i}`, output: `${i}`, ok: true });
    expect(h.list()).toHaveLength(HistoryStore.MAX);
    expect(h.list()[0].input).toBe(`${HistoryStore.MAX + 4}`);
    h.clear();
    expect(h.list()).toHaveLength(0);
  });
});
