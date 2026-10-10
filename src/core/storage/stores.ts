/**
 * Persistência da biblioteca (fórmulas e projetos) e do histórico.
 * O armazenamento é injetável: no navegador usa localStorage; nos testes,
 * uma implementação em memória.
 */
import type { AreaId } from '../physics/areas';
import { AREAS } from '../physics/areas';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorage implements KeyValueStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

/** localStorage quando disponível; senão memória (ex.: navegação privada bloqueada). */
export function browserStorage(): KeyValueStorage {
  try {
    const ls = globalThis.localStorage;
    const probe = '__tpw_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return new MemoryStorage();
  }
}

export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface SavedFormula {
  id: string;
  name: string;
  expression: string;
  area: AreaId;
  description: string;
  tags: string[];
  projectId: string | null;
  /** Unidades atribuídas às variáveis (para verificação dimensional). */
  variableUnits: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
}

export type FormulaInput = Omit<SavedFormula, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

const AREA_IDS = new Set<string>(AREAS.map((a) => a.id));

const str = (v: unknown, max = 5000) => (typeof v === 'string' ? v.slice(0, max) : '');

function sanitizeFormula(raw: unknown): SavedFormula | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const expression = str(r.expression, 2000).trim();
  const name = str(r.name, 200).trim();
  if (!expression || !name) return null;
  const units: Record<string, string> = {};
  if (r.variableUnits && typeof r.variableUnits === 'object') {
    for (const [k, v] of Object.entries(r.variableUnits as Record<string, unknown>)) {
      if (typeof v === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) units[k] = v.slice(0, 100);
    }
  }
  const now = Date.now();
  return {
    id: str(r.id, 100) || newId(),
    name,
    expression,
    area: (AREA_IDS.has(str(r.area)) ? r.area : 'outra') as AreaId,
    description: str(r.description),
    tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string').map((t) => t.trim().slice(0, 50)).filter(Boolean) : [],
    projectId: typeof r.projectId === 'string' && r.projectId ? r.projectId : null,
    variableUnits: units,
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : now,
  };
}

function sanitizeProject(raw: unknown): Project | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.name, 200).trim();
  if (!name) return null;
  return { id: str(r.id, 100) || newId(), name, description: str(r.description), createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now() };
}

interface LibraryData {
  version: 1;
  formulas: SavedFormula[];
  projects: Project[];
}

export class LibraryStore {
  /** Mensagem de aviso se os dados salvos estavam corrompidos. */
  loadWarning: string | null = null;
  private data: LibraryData;

  constructor(
    private storage: KeyValueStorage,
    private key = 'tpw.library.v1',
  ) {
    this.data = this.load();
  }

  private load(): LibraryData {
    const empty: LibraryData = { version: 1, formulas: [], projects: [] };
    const text = this.storage.getItem(this.key);
    if (!text) return empty;
    try {
      const parsed = JSON.parse(text) as Partial<LibraryData>;
      return {
        version: 1,
        formulas: (parsed.formulas ?? []).map(sanitizeFormula).filter((f): f is SavedFormula => !!f),
        projects: (parsed.projects ?? []).map(sanitizeProject).filter((p): p is Project => !!p),
      };
    } catch {
      this.loadWarning = 'Os dados da biblioteca estavam corrompidos e foram reiniciados.';
      return empty;
    }
  }

  private persist() {
    this.storage.setItem(this.key, JSON.stringify(this.data));
  }

  formulas(): SavedFormula[] {
    return [...this.data.formulas].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  projects(): Project[] {
    return [...this.data.projects].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  getFormula(id: string): SavedFormula | undefined {
    return this.data.formulas.find((f) => f.id === id);
  }

  saveFormula(input: FormulaInput): SavedFormula {
    const existing = input.id ? this.getFormula(input.id) : undefined;
    const now = Date.now();
    const clean = sanitizeFormula({ ...input, id: existing?.id ?? newId(), createdAt: existing?.createdAt ?? now, updatedAt: now });
    if (!clean) throw new Error('A fórmula precisa de nome e expressão.');
    if (clean.projectId && !this.data.projects.some((p) => p.id === clean.projectId)) clean.projectId = null;
    if (existing) this.data.formulas = this.data.formulas.map((f) => (f.id === clean.id ? clean : f));
    else this.data.formulas.push(clean);
    this.persist();
    return clean;
  }

  removeFormula(id: string) {
    this.data.formulas = this.data.formulas.filter((f) => f.id !== id);
    this.persist();
  }

  saveProject(input: { id?: string; name: string; description?: string }): Project {
    const existing = input.id ? this.data.projects.find((p) => p.id === input.id) : undefined;
    const clean = sanitizeProject({ ...existing, ...input, id: existing?.id ?? newId() });
    if (!clean) throw new Error('O projeto precisa de um nome.');
    if (existing) this.data.projects = this.data.projects.map((p) => (p.id === clean.id ? clean : p));
    else this.data.projects.push(clean);
    this.persist();
    return clean;
  }

  /** Remove o projeto; as fórmulas dele ficam sem projeto (não são apagadas). */
  removeProject(id: string) {
    this.data.projects = this.data.projects.filter((p) => p.id !== id);
    this.data.formulas = this.data.formulas.map((f) => (f.projectId === id ? { ...f, projectId: null } : f));
    this.persist();
  }

  exportJSON(): string {
    return JSON.stringify({ app: 'theoretical-physics-web', ...this.data }, null, 2);
  }

  /** Importa (mescla) fórmulas e projetos; itens com o mesmo id são substituídos. */
  importJSON(text: string): { formulas: number; projects: number } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Arquivo inválido: não é um JSON.');
    }
    if (!parsed || typeof parsed !== 'object') throw new Error('Arquivo inválido.');
    const p = parsed as { formulas?: unknown; projects?: unknown };
    const projects = (Array.isArray(p.projects) ? p.projects : []).map(sanitizeProject).filter((x): x is Project => !!x);
    const formulas = (Array.isArray(p.formulas) ? p.formulas : []).map(sanitizeFormula).filter((x): x is SavedFormula => !!x);
    if (!projects.length && !formulas.length) throw new Error('Nenhuma fórmula ou projeto válido encontrado no arquivo.');
    const pIds = new Set(projects.map((x) => x.id));
    this.data.projects = [...this.data.projects.filter((x) => !pIds.has(x.id)), ...projects];
    const known = new Set(this.data.projects.map((x) => x.id));
    const fIds = new Set(formulas.map((x) => x.id));
    this.data.formulas = [
      ...this.data.formulas.filter((x) => !fIds.has(x.id)),
      ...formulas.map((f) => (f.projectId && !known.has(f.projectId) ? { ...f, projectId: null } : f)),
    ];
    this.persist();
    return { formulas: formulas.length, projects: projects.length };
  }
}

export type HistoryKind = 'avaliar' | 'simplificar' | 'derivar' | 'resolver' | 'integrar' | 'fórmula' | 'conversão' | 'dimensões' | 'simulação' | 'gráfico';

export interface HistoryEntry {
  id: string;
  timestamp: number;
  kind: HistoryKind;
  input: string;
  output: string;
  ok: boolean;
  /** Dados para reabrir o cálculo na ferramenta de origem. */
  payload?: Record<string, unknown>;
}

export class HistoryStore {
  static readonly MAX = 300;
  private entries: HistoryEntry[];

  constructor(
    private storage: KeyValueStorage,
    private key = 'tpw.history.v1',
  ) {
    this.entries = this.load();
  }

  private load(): HistoryEntry[] {
    try {
      const parsed = JSON.parse(this.storage.getItem(this.key) ?? '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (e): e is HistoryEntry => e && typeof e.id === 'string' && typeof e.timestamp === 'number' && typeof e.input === 'string' && typeof e.output === 'string',
      );
    } catch {
      return [];
    }
  }

  private persist() {
    this.storage.setItem(this.key, JSON.stringify(this.entries));
  }

  list(): HistoryEntry[] {
    return [...this.entries];
  }

  add(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): HistoryEntry {
    const e: HistoryEntry = { ...entry, input: entry.input.slice(0, 2000), output: entry.output.slice(0, 4000), id: newId(), timestamp: Date.now() };
    if (e.payload !== undefined && (typeof e.payload !== 'object' || e.payload === null || JSON.stringify(e.payload).length > 20000)) delete e.payload;
    this.entries = [e, ...this.entries].slice(0, HistoryStore.MAX);
    this.persist();
    return e;
  }

  remove(id: string) {
    this.entries = this.entries.filter((e) => e.id !== id);
    this.persist();
  }

  clear() {
    this.entries = [];
    this.persist();
  }
}
