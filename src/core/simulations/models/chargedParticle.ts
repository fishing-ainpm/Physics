import { MathError } from '../../math/engine';
import { K } from '../../physics/constants';
import type { SimulationModel } from '../types';
import { decimate } from '../util';

type Vec = [number, number, number];

const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Integrador de Boris (não relativístico) para campos E e B uniformes.
 * Conserva exatamente |v| quando E = 0 e é o padrão em simulações de plasma.
 */
export function borisPush(q: number, m: number, E: Vec, B: Vec, x0: Vec, v0: Vec, dt: number, steps: number) {
  const xs: Vec[] = [x0];
  const vs: Vec[] = [v0];
  let x = [...x0] as Vec;
  let v = [...v0] as Vec;
  const qm = (q / m) * (dt / 2);
  const t: Vec = [qm * B[0], qm * B[1], qm * B[2]];
  const t2 = t[0] ** 2 + t[1] ** 2 + t[2] ** 2;
  const s: Vec = [(2 * t[0]) / (1 + t2), (2 * t[1]) / (1 + t2), (2 * t[2]) / (1 + t2)];
  for (let k = 0; k < steps; k++) {
    const vm: Vec = [v[0] + qm * E[0], v[1] + qm * E[1], v[2] + qm * E[2]];
    const c1 = cross(vm, t);
    const vp1: Vec = [vm[0] + c1[0], vm[1] + c1[1], vm[2] + c1[2]];
    const c2 = cross(vp1, s);
    const vp: Vec = [vm[0] + c2[0], vm[1] + c2[1], vm[2] + c2[2]];
    v = [vp[0] + qm * E[0], vp[1] + qm * E[1], vp[2] + qm * E[2]];
    x = [x[0] + v[0] * dt, x[1] + v[1] * dt, x[2] + v[2] * dt];
    xs.push(x);
    vs.push(v);
  }
  return { xs, vs };
}

export const chargedParticleModel: SimulationModel = {
  id: 'charged-particle',
  area: 'eletromagnetismo',
  name: 'Partícula carregada em campos E e B uniformes',
  description: 'Integra a força de Lorentz para uma carga em campo magnético na direção z e campo elétrico no plano xy, mostrando o movimento de cíclotron e a deriva E×B.',
  equations: [
    'm\\,\\dot{\\vec v} = q\\left(\\vec E + \\vec v \\times \\vec B\\right)',
    '\\omega_c = \\dfrac{|q|B}{m},\\quad T_c = \\dfrac{2\\pi m}{|q|B},\\quad r_L = \\dfrac{m v_\\perp}{|q|B}',
    '\\vec v_{E\\times B} = \\dfrac{\\vec E \\times \\vec B}{B^2}',
  ],
  method: 'Integrador de Boris com 400 passos por período de cíclotron.',
  assumptions: ['Campos uniformes e estáticos', 'Movimento não relativístico', 'Sem radiação (perda de energia por Larmor desprezada)'],
  limitations: ['Invalida-se para v ≳ 0,1c (use o integrador de Boris relativístico)', 'Sem interação entre partículas'],
  references: ['Boris (1970); Birdsall & Langdon, Plasma Physics via Computer Simulation', 'Jackson, Classical Electrodynamics, §12'],
  parameters: [
    { key: 'q', label: 'Carga', unit: 'e', default: 1, min: -100, max: 100, step: 1 },
    { key: 'm', label: 'Massa', unit: 'mₚ', default: 1, min: 1e-4, max: 1e4, step: 0.001, help: 'Elétron ≈ 0,000544' },
    { key: 'Bz', label: 'Campo magnético B_z', unit: 'T', default: 0.01, min: 1e-9, max: 100, step: 0.001 },
    { key: 'Ex', label: 'Campo elétrico E_x', unit: 'V/m', default: 0, min: -1e7, max: 1e7, step: 10 },
    { key: 'Ey', label: 'Campo elétrico E_y', unit: 'V/m', default: 200, min: -1e7, max: 1e7, step: 10 },
    { key: 'vx', label: 'Velocidade inicial v_x', unit: 'm/s', default: 1e5, min: -3e7, max: 3e7, step: 1000 },
    { key: 'vz', label: 'Velocidade inicial v_z', unit: 'm/s', default: 0, min: -3e7, max: 3e7, step: 1000 },
    { key: 'periods', label: 'Duração (períodos de cíclotron)', unit: '', default: 5, min: 1, max: 50, step: 1 },
  ],
  run(p) {
    if (p.q === 0) throw new MathError('A carga deve ser diferente de zero.');
    const q = p.q * K('qe');
    const m = p.m * K('mp');
    const B: Vec = [0, 0, p.Bz];
    const E: Vec = [p.Ex, p.Ey, 0];
    const wc = (Math.abs(q) * p.Bz) / m;
    const Tc = (2 * Math.PI) / wc;
    const stepsPer = 400;
    const dt = Tc / stepsPer;
    const steps = Math.round(p.periods * stepsPer);
    const { xs, vs } = borisPush(q, m, E, B, [0, 0, 0], [p.vx, 0, p.vz], dt, steps);
    const t = xs.map((_, k) => k * dt);
    const drift = cross(E, B).map((c) => c / (p.Bz * p.Bz)) as Vec;
    const vPerp0 = Math.hypot(p.vx - drift[0], -drift[1]);
    const rL = (m * vPerp0) / (Math.abs(q) * p.Bz);
    const nP = Math.floor(p.periods);
    const iP = nP * stepsPer;
    const simDrift: Vec = [(xs[iP][0] - xs[0][0]) / (iP * dt), (xs[iP][1] - xs[0][1]) / (iP * dt), (xs[iP][2] - xs[0][2]) / (iP * dt)];
    const speeds = vs.map((v) => Math.hypot(v[0], v[1], v[2]));
    const vmax = Math.max(...speeds);
    const warnings: string[] = [];
    if (vmax > 0.1 * K('c')) warnings.push(`A velocidade chega a ${(vmax / K('c')).toFixed(3)} c: correções relativísticas tornam-se importantes.`);
    const mm = (x: number) => x * 1000;
    const us = (x: number) => x * 1e6;
    return {
      plots: [
        {
          title: 'Trajetória no plano xy',
          xLabel: 'x (mm)',
          yLabel: 'y (mm)',
          equalAxes: true,
          traces: [{ name: 'Trajetória (Boris)', x: decimate(xs.map((r) => mm(r[0])), 4000), y: decimate(xs.map((r) => mm(r[1])), 4000) }],
        },
        {
          title: 'Componentes da velocidade',
          xLabel: 't (µs)',
          yLabel: 'v (m/s)',
          traces: [
            { name: 'v_x', x: decimate(t.map(us)), y: decimate(vs.map((v) => v[0])) },
            { name: 'v_y', x: decimate(t.map(us)), y: decimate(vs.map((v) => v[1])) },
            { name: '|v|', x: decimate(t.map(us)), y: decimate(speeds), dash: true },
          ],
        },
      ],
      summary: [
        { label: 'Período de cíclotron T_c', value: us(Tc), unit: 'µs' },
        { label: 'Frequência de cíclotron f_c', value: 1 / Tc, unit: 'Hz' },
        { label: 'Raio de Larmor (no referencial de deriva)', value: mm(rL), unit: 'mm' },
        { label: 'Deriva E×B teórica v_x', value: drift[0], unit: 'm/s' },
        { label: 'Deriva simulada v_x (média em períodos inteiros)', value: simDrift[0], unit: 'm/s' },
        { label: 'Deriva E×B teórica v_y', value: drift[1], unit: 'm/s' },
        { label: 'Deriva simulada v_y', value: simDrift[1], unit: 'm/s' },
      ],
      warnings,
    };
  },
};
