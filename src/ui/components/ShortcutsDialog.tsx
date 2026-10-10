import { useEffect, useRef } from 'react';
import { SHORTCUTS } from '../input/shortcuts';

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previous?.focus?.();
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ alignItems: 'center' }}>
          <h2 id="shortcuts-title" style={{ margin: 0 }}>
            Atalhos de teclado
          </h2>
          <span className="spacer" />
          <button ref={closeRef} className="btn small" onClick={onClose} aria-label="Fechar (Esc)">
            ✕
          </button>
        </div>
        <table className="data" style={{ marginTop: '0.75rem' }}>
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.keys}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {s.keys.split(/(\s\+\s|\s…\s|\s{2}ou\s{2}|\s\/\s)/).map((part, i) =>
                    /^\s/.test(part) ? <span key={i} className="muted"> {part.trim()} </span> : <kbd key={i}>{part}</kbd>,
                  )}
                </td>
                <td>{s.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small muted" style={{ marginTop: '0.75rem' }}>
          No celular ou tablet, use o botão ⌨ para abrir o teclado matemático. As teclas escrevem no último campo tocado; ↵ Calcular executa a página.
        </p>
      </div>
    </div>
  );
}
