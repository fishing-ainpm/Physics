import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HistoryStore, LibraryStore, browserStorage } from '../core/storage/stores';
import { AppContext, type AppContextValue, type Drafts, type Tab } from './AppContext';
import { CalculatorPage } from './pages/CalculatorPage';
import { EditorPage } from './pages/EditorPage';
import { GraphsPage } from './pages/GraphsPage';
import { HistoryPage } from './pages/HistoryPage';
import { LibraryPage } from './pages/LibraryPage';
import { SimulationsPage } from './pages/SimulationsPage';
import { UnitsPage } from './pages/UnitsPage';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'editor', label: 'Editor de fórmulas', icon: '∑' },
  { id: 'calculadora', label: 'Calculadora', icon: '=' },
  { id: 'simulacoes', label: 'Simulações', icon: '◎' },
  { id: 'graficos', label: 'Gráficos', icon: '∿' },
  { id: 'unidades', label: 'Unidades', icon: '⚖' },
  { id: 'biblioteca', label: 'Biblioteca', icon: '▤' },
  { id: 'historico', label: 'Histórico', icon: '↺' },
];

const isTab = (s: string): s is Tab => TABS.some((t) => t.id === s);

function tabFromHash(): Tab {
  const h = window.location.hash.replace(/^#\/?/, '');
  return isTab(h) ? h : 'editor';
}

export function App() {
  const storage = useMemo(() => browserStorage(), []);
  const library = useMemo(() => new LibraryStore(storage), [storage]);
  const history = useMemo(() => new HistoryStore(storage), [storage]);
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [pageKey, setPageKey] = useState(0);
  const [libraryVersion, setLibraryVersion] = useState(0);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [toastMsg, setToastMsg] = useState<string | null>(library.loadWarning);
  const drafts = useRef<Drafts>({});

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const id = window.setTimeout(() => setToastMsg(null), 3500);
    return () => window.clearTimeout(id);
  }, [toastMsg]);

  const navigate = useCallback((t: Tab) => {
    if (window.location.hash !== `#/${t}`) window.location.hash = `/${t}`;
    setTab(t);
    window.scrollTo({ top: 0 });
  }, []);

  const ctx: AppContextValue = useMemo(
    () => ({
      library,
      history,
      libraryVersion,
      historyVersion,
      libraryChanged: () => setLibraryVersion((v) => v + 1),
      historyChanged: () => setHistoryVersion((v) => v + 1),
      addHistory: (entry) => {
        try {
          history.add(entry);
        } catch {
          setToastMsg('Não foi possível salvar no histórico (armazenamento cheio?).');
        }
        setHistoryVersion((v) => v + 1);
      },
      navigate,
      open: (t, draft) => {
        drafts.current = { ...drafts.current, [t]: draft };
        setPageKey((k) => k + 1); // remonta a página para ler o rascunho
        navigate(t);
      },
      peekDraft: (t) => drafts.current[t],
      clearDraft: (t) => {
        const next = { ...drafts.current };
        delete next[t];
        drafts.current = next;
      },
      toast: (m) => setToastMsg(m),
    }),
    [library, history, libraryVersion, historyVersion, navigate],
  );

  const page = (() => {
    switch (tab) {
      case 'editor':
        return <EditorPage />;
      case 'calculadora':
        return <CalculatorPage />;
      case 'simulacoes':
        return <SimulationsPage />;
      case 'graficos':
        return <GraphsPage />;
      case 'unidades':
        return <UnitsPage />;
      case 'biblioteca':
        return <LibraryPage />;
      case 'historico':
        return <HistoryPage />;
    }
  })();

  return (
    <AppContext.Provider value={ctx}>
      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-logo" aria-hidden>
              ⚛
            </span>
            <div>
              <div className="brand-title">Física Teórica na Web</div>
              <div className="brand-sub">Laboratório de fórmulas e modelos</div>
            </div>
          </div>
          <nav className="nav" aria-label="Ferramentas">
            {TABS.map((t) => (
              <button key={t.id} aria-current={tab === t.id ? 'page' : undefined} onClick={() => navigate(t.id)}>
                <span className="icon" aria-hidden>
                  {t.icon}
                </span>
                {t.label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="main" key={`${tab}-${pageKey}`}>
          {page}
        </main>
      </div>
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </AppContext.Provider>
  );
}
