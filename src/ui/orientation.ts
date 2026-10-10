/**
 * Orientação da tela no app Android (Capacitor). No navegador e no Windows
 * a tela acompanha a janela, então a opção só aparece no app nativo.
 */
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';

export type OrientationPref = 'auto' | 'portrait' | 'landscape';

const KEY = 'tpw.orientation.v1';

export const ORIENTATION_OPTIONS: { id: OrientationPref; label: string; help: string }[] = [
  { id: 'auto', label: 'Automática', help: 'Gira junto com o aparelho' },
  { id: 'portrait', label: 'Retrato', help: 'Sempre em pé' },
  { id: 'landscape', label: 'Paisagem', help: 'Sempre deitada, boa para gráficos' },
];

export function orientationSupported(): boolean {
  return Capacitor.isNativePlatform();
}

export function loadOrientation(): OrientationPref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'portrait' || v === 'landscape' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export async function applyOrientation(pref: OrientationPref): Promise<void> {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* armazenamento indisponível */
  }
  if (!orientationSupported()) return;
  if (pref === 'auto') await ScreenOrientation.unlock();
  else await ScreenOrientation.lock({ orientation: pref });
}
