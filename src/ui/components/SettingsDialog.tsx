import { useEffect, useRef, useState } from 'react';
import { ORIENTATION_OPTIONS, applyOrientation, loadOrientation, orientationSupported, type OrientationPref } from '../orientation';

export function SettingsDialog({ onClose, onError }: { onClose: () => void; onError: (msg: string) => void }) {
  const [pref, setPref] = useState<OrientationPref>(loadOrientation);
  const closeRef = useRef<HTMLButtonElement>(null);
  const supported = orientationSupported();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  function choose(p: OrientationPref) {
    setPref(p);
    applyOrientation(p).catch(() => onError('Não foi possível mudar a orientação da tela neste aparelho.'));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ alignItems: 'center' }}>
          <h2 id="settings-title" style={{ margin: 0 }}>
            Configurações
          </h2>
          <span className="spacer" />
          <button ref={closeRef} className="btn small" onClick={onClose} aria-label="Fechar (Esc)">
            ✕
          </button>
        </div>
        <fieldset className="settings-group" disabled={!supported}>
          <legend>Orientação da tela</legend>
          <div className="orientation-options">
            {ORIENTATION_OPTIONS.map((o) => (
              <label key={o.id} className={`orientation-option${pref === o.id ? ' selected' : ''}`}>
                <input type="radio" name="orientation" value={o.id} checked={pref === o.id} onChange={() => choose(o.id)} />
                <span className={`orientation-icon ${o.id}`} aria-hidden />
                <span className="orientation-label">{o.label}</span>
                <span className="small muted">{o.help}</span>
              </label>
            ))}
          </div>
          {!supported && <p className="small muted">Disponível no app Android. No navegador e no Windows, a tela acompanha o tamanho da janela.</p>}
        </fieldset>
      </div>
    </div>
  );
}
