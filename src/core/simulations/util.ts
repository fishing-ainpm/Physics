/** Pontos igualmente espaçados em [a, b]. */
export function linspace(a: number, b: number, n: number): number[] {
  if (n < 2) return [a];
  return Array.from({ length: n }, (_, k) => a + ((b - a) * k) / (n - 1));
}

/** Reduz uma série para no máximo `max` pontos (mantém o primeiro e o último). */
export function decimate<T>(values: T[], max = 2000): T[] {
  if (values.length <= max) return values;
  const step = (values.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, k) => values[Math.round(k * step)]);
}

export const SECONDS_PER_YEAR = 365.25 * 86400; // ano juliano
export const MPC_IN_M = 3.0856775814913673e22;
