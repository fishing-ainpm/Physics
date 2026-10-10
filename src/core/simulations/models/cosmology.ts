import { MathError, integrate } from '../../math/engine';
import { K } from '../../physics/constants';
import type { SimulationModel } from '../types';
import { MPC_IN_M, SECONDS_PER_YEAR, linspace } from '../util';

export interface CosmoParams {
  /** km/s/Mpc */
  H0: number;
  Om: number;
  OL: number;
  Or: number;
}

const GYR = 1e9 * SECONDS_PER_YEAR;

export function hubbleSI(H0: number): number {
  return (H0 * 1000) / MPC_IN_M;
}

/** E(a)² = H²/H₀² = Ωr a⁻⁴ + Ωm a⁻³ + Ωk a⁻² + ΩΛ */
export function E2(a: number, p: CosmoParams): number {
  const Ok = 1 - p.Om - p.OL - p.Or;
  return p.Or / a ** 4 + p.Om / a ** 3 + Ok / a ** 2 + p.OL;
}

/** Idade do universo no fator de escala a: t(a) = ∫₀ᵃ da' / (a' H(a')). */
export function cosmicTime(a: number, p: CosmoParams): number {
  const H0 = hubbleSI(p.H0);
  // Substituição a = u² remove a singularidade integrável em a → 0 quando Ωr = 0.
  const f = (u: number) => {
    if (u === 0) return 0; // integrando → 0 quando a → 0 (matéria, radiação ou curvatura dominam)
    const aa = u * u;
    const e2 = E2(aa, p);
    if (e2 <= 0) throw new MathError(`H² ≤ 0 em a = ${aa.toPrecision(3)}: esses parâmetros não descrevem um universo em expansão contínua desde o Big Bang.`);
    return (2 * u) / (aa * Math.sqrt(e2));
  };
  if (p.Or === 0 && p.Om === 0 && 1 - p.OL <= 0) {
    throw new MathError('Sem matéria, radiação nem curvatura negativa dominante não há Big Bang a tempo finito (tipo de Sitter): idade infinita.');
  }
  return integrate(f, 0, Math.sqrt(a), 1e-10).value / H0;
}

/** Distância comóvel radial D_C(z) = c ∫₀ᶻ dz'/H(z'). */
export function comovingDistance(z: number, p: CosmoParams): number {
  const H0 = hubbleSI(p.H0);
  const val = integrate((zz) => 1 / Math.sqrt(E2(1 / (1 + zz), p)), 0, z, 1e-10).value;
  return (K('c') / H0) * val;
}

/** Distância comóvel transversal D_M, considerando curvatura. */
export function transverseDistance(z: number, p: CosmoParams): number {
  const Ok = 1 - p.Om - p.OL - p.Or;
  const DH = K('c') / hubbleSI(p.H0);
  const DC = comovingDistance(z, p);
  if (Math.abs(Ok) < 1e-12) return DC;
  const s = Math.sqrt(Math.abs(Ok));
  return Ok > 0 ? (DH / s) * Math.sinh((s * DC) / DH) : (DH / s) * Math.sin((s * DC) / DH);
}

export const cosmologyModel: SimulationModel = {
  id: 'lcdm',
  area: 'cosmologia',
  name: 'Expansão do universo (modelo ΛCDM / Friedmann)',
  description: 'Integra a equação de Friedmann para obter a idade do universo, a evolução do fator de escala e as distâncias cosmológicas em função do redshift.',
  equations: [
    'H(a)^2 = H_0^2\\left(\\Omega_r a^{-4} + \\Omega_m a^{-3} + \\Omega_k a^{-2} + \\Omega_\\Lambda\\right)',
    '\\Omega_k = 1 - \\Omega_m - \\Omega_\\Lambda - \\Omega_r',
    't(a) = \\int_0^a \\dfrac{da\'}{a\' H(a\')},\\quad D_C(z) = c\\int_0^z \\dfrac{dz\'}{H(z\')}',
    'D_L = (1+z)\\,D_M,\\quad D_A = D_M/(1+z)',
  ],
  method: 'Quadratura de Simpson adaptativa (com substituição a = u² perto do Big Bang).',
  assumptions: ['Métrica FLRW (universo homogêneo e isotrópico)', 'Matéria sem pressão, radiação com w = 1/3, Λ constante (w = −1)', 'Neutrinos tratados como radiação ou matéria (não ambos)'],
  limitations: ['Não modela energia escura dinâmica (w ≠ −1) nem a transição dos neutrinos massivos', 'Parâmetros que fazem H² ≤ 0 no passado (sem Big Bang) são rejeitados'],
  references: ['Hogg (1999), "Distance measures in cosmology", arXiv:astro-ph/9905116', 'Planck 2018 VI: H₀ = 67,4, Ωm = 0,315 (A&A 641, A6)'],
  parameters: [
    { key: 'H0', label: 'Constante de Hubble H₀', unit: 'km/s/Mpc', default: 67.4, min: 1, max: 200, step: 0.1 },
    { key: 'Om', label: 'Densidade de matéria Ωm', unit: '', default: 0.315, min: 0, max: 5, step: 0.005 },
    { key: 'OL', label: 'Constante cosmológica ΩΛ', unit: '', default: 0.685, min: -2, max: 5, step: 0.005 },
    { key: 'Or', label: 'Densidade de radiação Ωr', unit: '', default: 9.1e-5, min: 0, max: 1, step: 1e-5 },
    { key: 'zmax', label: 'Redshift máximo (distâncias)', unit: '', default: 5, min: 0.01, max: 1100, step: 0.1 },
  ],
  run(p) {
    const cp: CosmoParams = { H0: p.H0, Om: p.Om, OL: p.OL, Or: p.Or };
    const Ok = 1 - p.Om - p.OL - p.Or;
    const warnings: string[] = [];
    const age = cosmicTime(1, cp);

    // a(t): passado (a de 1e-3 a 1) e futuro até a = 3 ou até o recolapso.
    const aGrid: number[] = [...linspace(-3, 0, 120).map((e) => 10 ** e)];
    let turnaround: number | null = null;
    for (const a of linspace(1, 3, 80).slice(1)) {
      if (E2(a, cp) <= 0) {
        turnaround = a;
        break;
      }
      aGrid.push(a);
    }
    if (turnaround !== null) warnings.push(`A expansão para próximo de a ≈ ${turnaround.toFixed(2)}: este universo recolapsa no futuro.`);
    const tGrid = aGrid.map((a) => cosmicTime(a, cp) / GYR);

    const zs = linspace(0, p.zmax, 150);
    const DM = zs.map((z) => transverseDistance(z, cp));
    const toGpc = (d: number) => d / (1000 * MPC_IN_M);
    const q0 = p.Or + p.Om / 2 - p.OL;
    if (Math.abs(Ok) > 1e-6) warnings.push(`Universo não plano: Ωk = ${Ok.toFixed(4)}.`);

    return {
      plots: [
        {
          title: 'Fator de escala a(t)',
          xLabel: 't desde o Big Bang (Ga)',
          yLabel: 'a',
          traces: [
            { name: 'a(t)', x: tGrid, y: aGrid },
            { name: 'Hoje (a = 1)', x: [age / GYR], y: [1], mode: 'markers' },
          ],
        },
        {
          title: 'Distâncias cosmológicas',
          xLabel: 'redshift z',
          yLabel: 'distância (Gpc)',
          traces: [
            { name: 'Comóvel D_M', x: zs, y: DM.map(toGpc) },
            { name: 'Luminosidade D_L', x: zs, y: DM.map((d, i) => toGpc(d * (1 + zs[i]))) },
            { name: 'Diâmetro angular D_A', x: zs, y: DM.map((d, i) => toGpc(d / (1 + zs[i]))), dash: true },
          ],
        },
        {
          title: 'Parâmetro de Hubble H(z)',
          xLabel: 'redshift z',
          yLabel: 'H (km/s/Mpc)',
          traces: [{ name: 'H(z)', x: zs, y: zs.map((z) => p.H0 * Math.sqrt(E2(1 / (1 + z), cp))) }],
        },
      ],
      summary: [
        { label: 'Idade do universo', value: age / GYR, unit: 'Ga' },
        { label: 'Tempo de Hubble 1/H₀', value: 1 / hubbleSI(p.H0) / GYR, unit: 'Ga' },
        { label: 'Curvatura Ωk', value: Ok, unit: '' },
        { label: 'Parâmetro de desaceleração q₀', value: q0, unit: '' },
        { label: `Distância de luminosidade em z = ${p.zmax}`, value: toGpc(DM[DM.length - 1] * (1 + p.zmax)), unit: 'Gpc' },
      ],
      warnings,
    };
  },
};
