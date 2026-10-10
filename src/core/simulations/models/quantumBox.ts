import { integrate } from '../../math/engine';
import { K } from '../../physics/constants';
import type { SimulationModel } from '../types';
import { linspace } from '../util';

/** Energia do n-ésimo nível do poço infinito: Eₙ = n²π²ħ²/(2mL²). */
export function boxEnergy(n: number, mass: number, L: number): number {
  const hbar = K('hbar');
  return (n * n * Math.PI * Math.PI * hbar * hbar) / (2 * mass * L * L);
}

/** Autofunção normalizada ψₙ(x) = √(2/L)·sen(nπx/L), 0 ≤ x ≤ L. */
export function boxPsi(n: number, L: number, x: number): number {
  if (x < 0 || x > L) return 0;
  return Math.sqrt(2 / L) * Math.sin((n * Math.PI * x) / L);
}

/** |Ψ(x,t)|² da superposição √(1−w)·ψ₁ + √w·ψ₂ (amplitudes reais em t = 0). */
export function superpositionDensity(n1: number, n2: number, w: number, mass: number, L: number, x: number, t: number): number {
  const hbar = K('hbar');
  const a = Math.sqrt(1 - w);
  const b = Math.sqrt(w);
  const p1 = boxPsi(n1, L, x);
  const p2 = boxPsi(n2, L, x);
  const dE = boxEnergy(n2, mass, L) - boxEnergy(n1, mass, L);
  return a * a * p1 * p1 + b * b * p2 * p2 + 2 * a * b * p1 * p2 * Math.cos((dE * t) / hbar);
}

export const quantumBoxModel: SimulationModel = {
  id: 'quantum-box',
  area: 'quantica',
  name: 'Partícula em poço infinito: superposição de estados',
  description:
    'Mostra os níveis de energia, as autofunções e a evolução temporal da densidade de probabilidade de uma superposição de dois estados estacionários.',
  equations: [
    'E_n = \\dfrac{n^2\\pi^2\\hbar^2}{2mL^2},\\quad \\psi_n(x) = \\sqrt{\\tfrac{2}{L}}\\sin\\dfrac{n\\pi x}{L}',
    '\\Psi(x,t) = \\sqrt{1-w}\\,\\psi_{n_1}e^{-iE_{n_1}t/\\hbar} + \\sqrt{w}\\,\\psi_{n_2}e^{-iE_{n_2}t/\\hbar}',
    'T_{osc} = \\dfrac{2\\pi\\hbar}{|E_{n_2} - E_{n_1}|}',
  ],
  method: 'Solução analítica da equação de Schrödinger; normalização e ⟨x⟩ verificados por integração numérica (Simpson adaptativo).',
  assumptions: ['Poço unidimensional com paredes infinitas', 'Partícula não relativística e sem spin', 'Coeficientes reais em t = 0'],
  limitations: ['Poços reais são finitos (há tunelamento e menos estados ligados)', 'Não inclui interações nem decoerência'],
  references: ['Griffiths, Introduction to Quantum Mechanics, §2.2', 'Constantes CODATA 2018'],
  parameters: [
    { key: 'L', label: 'Largura do poço', unit: 'nm', default: 1, min: 0.01, max: 1e4, step: 0.01 },
    { key: 'massRatio', label: 'Massa (em massas do elétron)', unit: 'mₑ', default: 1, min: 1e-3, max: 1e6, step: 0.01 },
    { key: 'n1', label: 'Estado n₁', unit: '', default: 1, min: 1, max: 50, step: 1, integer: true },
    { key: 'n2', label: 'Estado n₂', unit: '', default: 2, min: 1, max: 50, step: 1, integer: true },
    { key: 'w', label: 'Peso de n₂ na superposição (w)', unit: '', default: 0.5, min: 0, max: 1, step: 0.01 },
    { key: 'phase', label: 'Instante mostrado (fração de T_osc)', unit: '', default: 0.25, min: 0, max: 1, step: 0.01 },
  ],
  run(p) {
    const L = p.L * 1e-9;
    const m = p.massRatio * K('me');
    const eV = K('eV');
    const hbar = K('hbar');
    const warnings: string[] = [];
    const E1 = boxEnergy(p.n1, m, L);
    const E2 = boxEnergy(p.n2, m, L);
    const same = p.n1 === p.n2;
    if (same) warnings.push('n₁ = n₂: o estado é estacionário e a densidade não evolui no tempo.');
    const Tosc = same ? NaN : (2 * Math.PI * hbar) / Math.abs(E2 - E1);
    const w = same ? 0 : p.w;
    const tShow = same ? 0 : p.phase * Tosc;

    const xs = linspace(0, L, 400);
    const xn = xs.map((x) => x / 1e-9);
    const dens = (x: number, t: number) => superpositionDensity(p.n1, p.n2, w, m, L, x, t);
    const norm = integrate((x) => dens(x, tShow), 0, L, 1e-10).value;
    const meanX = (t: number) => integrate((x) => x * dens(x, t), 0, L, 1e-12 * L).value;

    const tGrid = same ? [0] : linspace(0, 2 * Tosc, 200);
    const nMax = Math.max(p.n1, p.n2, 4);
    const levels = Array.from({ length: Math.min(nMax, 50) }, (_, k) => k + 1);

    return {
      plots: [
        {
          title: 'Autofunções ψₙ(x)',
          xLabel: 'x (nm)',
          yLabel: 'ψ (nm^-1/2)',
          traces: [...new Set([p.n1, p.n2])].map((n) => ({
            name: `ψ${n}`,
            x: xn,
            y: xs.map((x) => boxPsi(n, L, x) * Math.sqrt(1e-9)),
          })),
        },
        {
          title: 'Densidade de probabilidade |Ψ(x,t)|²',
          xLabel: 'x (nm)',
          yLabel: '|Ψ|² (1/nm)',
          traces: [
            { name: 't = 0', x: xn, y: xs.map((x) => dens(x, 0) * 1e-9) },
            ...(same ? [] : [{ name: `t = ${p.phase.toFixed(2)}·T_osc`, x: xn, y: xs.map((x) => dens(x, tShow) * 1e-9), dash: true }]),
          ],
        },
        {
          title: 'Posição média ⟨x⟩(t)',
          xLabel: 't (fs)',
          yLabel: '⟨x⟩ (nm)',
          traces: [{ name: '⟨x⟩', x: tGrid.map((t) => t / 1e-15), y: tGrid.map((t) => meanX(t) / 1e-9), mode: same ? 'markers' : 'lines' }],
        },
        {
          title: 'Níveis de energia',
          xLabel: 'n',
          yLabel: 'Eₙ (eV)',
          traces: [{ name: 'Eₙ', x: levels, y: levels.map((n) => boxEnergy(n, m, L) / eV), mode: 'markers' }],
        },
      ],
      summary: [
        { label: `E${p.n1}`, value: E1 / eV, unit: 'eV' },
        { label: `E${p.n2}`, value: E2 / eV, unit: 'eV' },
        ...(same ? [] : [{ label: 'Período de oscilação T_osc', value: Tosc / 1e-15, unit: 'fs' }]),
        { label: 'Normalização ∫|Ψ|²dx (deve ser 1)', value: norm, unit: '' },
        { label: '⟨E⟩', value: ((1 - w) * E1 + w * E2) / eV, unit: 'eV' },
      ],
      warnings,
    };
  },
};
