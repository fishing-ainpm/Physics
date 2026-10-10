/**
 * Integradores numéricos de EDOs.
 */
import { MathError } from '../math/engine';

export type Derivative = (t: number, y: number[]) => number[];

export interface OdeSolution {
  t: number[];
  y: number[][];
}

/**
 * Runge–Kutta clássico de 4ª ordem com passo fixo.
 * @param stop critério opcional de parada (ex.: projétil atinge o solo).
 */
export function rk4(
  f: Derivative,
  y0: number[],
  t0: number,
  t1: number,
  dt: number,
  stop?: (t: number, y: number[]) => boolean,
  maxSteps = 2_000_000,
): OdeSolution {
  if (!(dt > 0) || !Number.isFinite(dt)) throw new MathError('Passo de integração inválido.');
  const n = Math.ceil((t1 - t0) / dt);
  if (n > maxSteps) throw new MathError('Número de passos excessivo; reduza a duração ou aumente o passo.');
  const t = [t0];
  const y = [y0.slice()];
  let tc = t0;
  let yc = y0.slice();
  const dim = y0.length;
  const add = (a: number[], b: number[], s: number) => {
    const r = new Array<number>(dim);
    for (let i = 0; i < dim; i++) r[i] = a[i] + s * b[i];
    return r;
  };
  for (let k = 0; k < n; k++) {
    const h = Math.min(dt, t1 - tc);
    const k1 = f(tc, yc);
    const k2 = f(tc + h / 2, add(yc, k1, h / 2));
    const k3 = f(tc + h / 2, add(yc, k2, h / 2));
    const k4 = f(tc + h, add(yc, k3, h));
    const next = new Array<number>(dim);
    for (let i = 0; i < dim; i++) next[i] = yc[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    if (next.some((v) => !Number.isFinite(v))) throw new MathError('A integração divergiu (valores não finitos). Ajuste os parâmetros.');
    tc += h;
    yc = next;
    t.push(tc);
    y.push(yc);
    if (stop && stop(tc, yc)) break;
  }
  return { t, y };
}

/** Média aritmético-geométrica, usada na integral elíptica completa K(k) = π / (2·AGM(1, √(1−k²))). */
export function agm(a: number, b: number): number {
  for (let i = 0; i < 100 && Math.abs(a - b) > 1e-15 * Math.abs(a); i++) {
    [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  }
  return (a + b) / 2;
}

/** Interpola linearmente para achar t em que g cruza zero entre dois pontos. */
export function crossing(t0: number, g0: number, t1: number, g1: number): number {
  return t0 + ((t1 - t0) * g0) / (g0 - g1);
}
