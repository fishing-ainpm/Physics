import { useEffect, useRef, useState } from 'react';
import { applyToTarget, currentTarget, submitCurrentPage } from '../input/editTarget';
import { insertAction, type KeyAction } from '../input/keyEdit';

interface Key {
  label: string;
  action: KeyAction | 'submit';
  title?: string;
  wide?: boolean;
  accent?: boolean;
}

const ins = (label: string, text = label, title?: string): Key => ({ label, action: insertAction(text), title });

const PAGES: { id: string; label: string; keys: Key[] }[] = [
  {
    id: 'num',
    label: '123',
    keys: [
      ins('7'), ins('8'), ins('9'), ins('÷', '/', 'Divisão'), ins('('), ins(')'),
      ins('4'), ins('5'), ins('6'), ins('×', '*', 'Multiplicação'), ins('xʸ', '^', 'Potência'), ins('x'),
      ins('1'), ins('2'), ins('3'), ins('−', '-', 'Subtração'), ins('√', 'sqrt()', 'Raiz quadrada'), ins('='),
      ins('0'), ins('.', '.', 'Ponto decimal'), ins('EXP', 'e', 'Notação científica: 1.5e-9'), ins('+'), ins('π', 'pi'), ins(',', ', ', 'Separador de argumentos'),
    ],
  },
  {
    id: 'fn',
    label: 'f(x)',
    keys: [
      ins('sin', 'sin()'), ins('cos', 'cos()'), ins('tan', 'tan()'), ins('asin', 'asin()'), ins('acos', 'acos()'), ins('atan', 'atan()'),
      ins('sinh', 'sinh()'), ins('cosh', 'cosh()'), ins('tanh', 'tanh()'), ins('exp', 'exp()'), ins('ln', 'log()', 'Logaritmo natural'), ins('log₁₀', 'log10()'),
      ins('√', 'sqrt()'), ins('∛', 'cbrt()'), ins('|x|', 'abs()'), ins('x²', '^2'), ins('x³', '^3'), ins('1/x', '1/'),
      ins('e', 'e', 'Número de Euler'), ins('π', 'pi'), ins('n!', '!', 'Fatorial'), ins('mod', ' mod '), ins('to', ' to ', 'Converter unidade: 5 km to m'), ins(';', '; ', 'Separar instruções'),
    ],
  },
  {
    id: 'const',
    label: 'αβ ħ',
    keys: [
      ins('c', 'c', 'Velocidade da luz'), ins('G', 'G', 'Constante gravitacional'), ins('h', 'h', 'Constante de Planck'), ins('ħ', 'hbar'), ins('k_B', 'kB'), ins('e⁻', 'qe', 'Carga elementar'),
      ins('mₑ', 'me', 'Massa do elétron'), ins('mₚ', 'mp', 'Massa do próton'), ins('ε₀', 'eps0'), ins('μ₀', 'mu0'), ins('N_A', 'NA'), ins('R', 'R', 'Constante dos gases'),
      ins('α', 'alpha'), ins('β', 'beta'), ins('γ', 'gamma'), ins('θ', 'theta'), ins('λ', 'lambda'), ins('μ', 'mu'),
      ins('ρ', 'rho'), ins('σ', 'sigma'), ins('τ', 'tau'), ins('φ', 'phi'), ins('ω', 'omega'), ins('Δ', 'Delta'),
    ],
  },
  {
    id: 'units',
    label: 'unid.',
    keys: [
      ins('m', ' m'), ins('s', ' s'), ins('kg', ' kg'), ins('N', ' N'), ins('J', ' J'), ins('W', ' W'),
      ins('Pa', ' Pa'), ins('K', ' K'), ins('°C', ' degC'), ins('eV', ' eV'), ins('C', ' C'), ins('V', ' V'),
      ins('A', ' A'), ins('T', ' T'), ins('Hz', ' Hz'), ins('mol', ' mol'), ins('km/h', ' km/h'), ins('m/s', ' m/s'),
      ins('nm', ' nm'), ins('µs', ' us'), ins('atm', ' atm'), ins('ly', ' lightyear'), ins('au', ' au'), ins('to', ' to '),
    ],
  },
];

const CONTROLS: Key[] = [
  { label: '←', action: { type: 'left' }, title: 'Mover o cursor para a esquerda' },
  { label: '→', action: { type: 'right' }, title: 'Mover o cursor para a direita' },
  { label: '⌫', action: { type: 'backspace' }, title: 'Apagar' },
  { label: 'Limpar', action: { type: 'clear' }, title: 'Apagar o campo inteiro' },
  { label: '↵ Calcular', action: 'submit', title: 'Executar (Ctrl+Enter)', wide: true, accent: true },
];

const STORE_KEY = 'tpw.keyboard.v1';

function loadPrefs(): { page: string; suppress: boolean } {
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  try {
    const p = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}');
    return { page: typeof p.page === 'string' ? p.page : 'num', suppress: typeof p.suppress === 'boolean' ? p.suppress : !!touch };
  } catch {
    return { page: 'num', suppress: !!touch };
  }
}

/**
 * Teclado matemático na tela. As teclas não roubam o foco: o texto vai
 * para o último campo usado. No celular pode esconder o teclado do sistema.
 */
export function VirtualKeyboard({ open, onClose, onMissingTarget }: { open: boolean; onClose: () => void; onMissingTarget: () => void }) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const panelRef = useRef<HTMLDivElement>(null);
  const page = PAGES.find((p) => p.id === prefs.page) ?? PAGES[0];

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(prefs));
    } catch {
      /* armazenamento indisponível */
    }
  }, [prefs]);

  // Reserva espaço no fim da página para o painel não cobrir o conteúdo.
  useEffect(() => {
    const el = panelRef.current;
    if (!open || !el) {
      document.documentElement.style.setProperty('--kb-height', '0px');
      return;
    }
    const ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--kb-height', `${el.offsetHeight}px`);
      // Mantém visível o campo em que se está digitando (o painel cobre a parte de baixo).
      const target = currentTarget();
      if (target) {
        const r = target.getBoundingClientRect();
        const limit = window.innerHeight - el.offsetHeight - 12;
        if (r.bottom > limit) window.scrollBy({ top: r.bottom - limit, behavior: 'smooth' });
      }
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.setProperty('--kb-height', '0px');
    };
  }, [open]);

  // Com o painel aberto, impede que o teclado do celular apareça por cima (inputmode="none").
  useEffect(() => {
    if (!open || !prefs.suppress) return;
    const mark = (el: Element | null) => {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || el.dataset.tpwIm !== undefined) return;
      el.dataset.tpwIm = el.getAttribute('inputmode') ?? '';
      el.setAttribute('inputmode', 'none');
    };
    const onFocus = (e: FocusEvent) => mark(e.target as Element);
    mark(currentTarget());
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('focusin', onFocus);
      document.querySelectorAll<HTMLElement>('[data-tpw-im]').forEach((el) => {
        const orig = el.dataset.tpwIm;
        if (orig) el.setAttribute('inputmode', orig);
        else el.removeAttribute('inputmode');
        delete el.dataset.tpwIm;
      });
    };
  }, [open, prefs.suppress]);

  if (!open) return null;

  function press(k: Key) {
    if (k.action === 'submit') {
      if (!submitCurrentPage()) onMissingTarget();
      return;
    }
    if (!applyToTarget(k.action)) onMissingTarget();
  }

  const keyButton = (k: Key, i: number) => (
    <button
      key={`${k.label}-${i}`}
      type="button"
      className={`vk-key${k.wide ? ' wide' : ''}${k.accent ? ' accent' : ''}`}
      title={k.title ?? k.label}
      aria-label={k.title ?? k.label}
      // Impede que o toque tire o foco do campo de texto.
      onPointerDown={(e) => e.preventDefault()}
      onClick={() => press(k)}
    >
      {k.label}
    </button>
  );

  return (
    <div className="vk" ref={panelRef} role="toolbar" aria-label="Teclado matemático">
      <div className="vk-head">
        <div className="vk-tabs" role="tablist">
          {PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={p.id === page.id}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => setPrefs({ ...prefs, page: p.id })}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="check small vk-suppress" title="Evita que o teclado do celular apareça por cima deste">
          <input type="checkbox" checked={prefs.suppress} onChange={(e) => setPrefs({ ...prefs, suppress: e.target.checked })} />
          Esconder teclado do sistema
        </label>
        <button type="button" className="btn small" onPointerDown={(e) => e.preventDefault()} onClick={onClose} aria-label="Fechar teclado (Esc)">
          ✕
        </button>
      </div>
      <div className="vk-grid">{page.keys.map(keyButton)}</div>
      <div className="vk-controls">{CONTROLS.map(keyButton)}</div>
    </div>
  );
}
