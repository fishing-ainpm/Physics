import { createContext, useContext } from 'react';
import type { HistoryEntry, HistoryStore, LibraryStore } from '../core/storage/stores';
import type { AreaId } from '../core/physics/areas';

export type Tab = 'editor' | 'calculadora' | 'simulacoes' | 'graficos' | 'unidades' | 'biblioteca' | 'historico';

export interface EditorDraft {
  expression: string;
  formulaId?: string;
  name?: string;
  area?: AreaId;
  description?: string;
  tags?: string[];
  projectId?: string | null;
  values?: Record<string, string>;
  units?: Record<string, string>;
  target?: string;
}

export type CalcMode = 'avaliar' | 'simplificar' | 'derivar' | 'resolver' | 'integrar';

export interface CalcDraft {
  mode: CalcMode;
  expression: string;
  variable?: string;
  min?: string;
  max?: string;
  params?: string;
  useConstants?: boolean;
}

export interface GraphDraft {
  functions: string[];
  variable?: string;
  min?: number;
  max?: number;
  params?: Record<string, number>;
}

export interface SimDraft {
  id: string;
  params?: Record<string, number>;
}

export interface Drafts {
  editor?: EditorDraft;
  calculadora?: CalcDraft;
  graficos?: GraphDraft;
  simulacoes?: SimDraft;
}

export interface AppContextValue {
  library: LibraryStore;
  history: HistoryStore;
  /** Muda sempre que a biblioteca é alterada (para re-renderizar listas). */
  libraryVersion: number;
  historyVersion: number;
  libraryChanged(): void;
  addHistory(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): void;
  historyChanged(): void;
  navigate(tab: Tab): void;
  /** Abre uma ferramenta já preenchida com um rascunho. */
  open<K extends keyof Drafts>(tab: K, draft: NonNullable<Drafts[K]>): void;
  peekDraft<K extends keyof Drafts>(tab: K): Drafts[K];
  clearDraft(tab: keyof Drafts): void;
  toast(message: string): void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp fora do AppContext');
  return ctx;
}
