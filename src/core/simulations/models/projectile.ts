import { crossing, rk4 } from '../integrators';
import type { SimulationModel } from '../types';
import { decimate, linspace } from '../util';

/**
 * Projétil com arrasto quadrático: m·dv/dt = m·g − ½·ρ·C_d·A·|v|·v.
 * Comparado com a solução analítica no vácuo.
 */
export const projectileModel: SimulationModel = {
  id: 'projectile',
  area: 'mecanica',
  name: 'Lançamento de projétil com resistência do ar',
  description: 'Integra a trajetória de uma esfera com arrasto quadrático e compara com a parábola ideal sem ar.',
  equations: [
    'm\\,\\dot{\\vec v} = m\\vec g - \\tfrac{1}{2}\\rho\\,C_d A\\,|\\vec v|\\,\\vec v',
    'A = \\pi d^2/4',
    '\\text{vácuo: } R = \\dfrac{v_0^2\\sin 2\\theta}{g}\\;(h_0 = 0)',
  ],
  method: 'Runge–Kutta de 4ª ordem, passo fixo de 1 ms; instante de impacto por interpolação linear.',
  assumptions: ['Esfera rígida sem rotação (sem efeito Magnus)', 'C_d constante (regime turbulento, Re ~ 10³–10⁵)', 'Ar parado, densidade uniforme', 'g uniforme, Terra plana e sem rotação'],
  limitations: ['C_d real varia com o número de Reynolds (crise do arrasto)', 'Não modela vento, rotação nem variação de densidade com a altitude'],
  references: ['Taylor, Classical Mechanics, cap. 2', 'Valores típicos: C_d ≈ 0,47 para esfera'],
  parameters: [
    { key: 'v0', label: 'Velocidade inicial', unit: 'm/s', default: 40, min: 0.1, max: 1000, step: 1 },
    { key: 'angle', label: 'Ângulo de lançamento', unit: '°', default: 45, min: 0.5, max: 89.5, step: 0.5 },
    { key: 'h0', label: 'Altura inicial', unit: 'm', default: 0, min: 0, max: 10000, step: 1 },
    { key: 'mass', label: 'Massa', unit: 'kg', default: 0.145, min: 1e-4, max: 1e4, step: 0.005 },
    { key: 'diameter', label: 'Diâmetro', unit: 'm', default: 0.074, min: 1e-4, max: 10, step: 0.001 },
    { key: 'cd', label: 'Coeficiente de arrasto C_d', unit: '', default: 0.47, min: 0, max: 3, step: 0.01, help: '0 desliga o arrasto' },
    { key: 'rho', label: 'Densidade do ar', unit: 'kg/m³', default: 1.225, min: 0, max: 20, step: 0.005 },
    { key: 'g', label: 'Gravidade', unit: 'm/s²', default: 9.81, min: 0.01, max: 100, step: 0.01 },
  ],
  run(p) {
    const theta = (p.angle * Math.PI) / 180;
    const area = (Math.PI * p.diameter ** 2) / 4;
    const k = (0.5 * p.rho * p.cd * area) / p.mass; // 1/m
    const vx0 = p.v0 * Math.cos(theta);
    const vy0 = p.v0 * Math.sin(theta);
    const warnings: string[] = [];

    // Tempo de voo no vácuo (limite superior com arrasto).
    const tVac = (vy0 + Math.sqrt(vy0 * vy0 + 2 * p.g * p.h0)) / p.g;
    const dt = Math.min(1e-3, tVac / 2000);
    const sol = rk4(
      (_t, [, , vx, vy]) => {
        const sp = Math.hypot(vx, vy);
        return [vx, vy, -k * sp * vx, -p.g - k * sp * vy];
      },
      [0, p.h0, vx0, vy0],
      0,
      tVac * 1.5 + 1,
      dt,
      (_t, y) => y[1] < 0,
    );
    const n = sol.t.length;
    const last = sol.y[n - 1];
    const prev = sol.y[n - 2];
    if (last[1] >= 0) warnings.push('O projétil não atingiu o solo no tempo simulado.');
    const tImpact = last[1] < 0 ? crossing(sol.t[n - 2], prev[1], sol.t[n - 1], last[1]) : sol.t[n - 1];
    const frac = last[1] < 0 ? (tImpact - sol.t[n - 2]) / (sol.t[n - 1] - sol.t[n - 2]) : 1;
    const lerp = (i: number) => prev[i] + frac * (last[i] - prev[i]);
    const range = lerp(0);
    const vImpact = Math.hypot(lerp(2), lerp(3));
    const xs = sol.y.map((s) => s[0]);
    const ys = sol.y.map((s) => s[1]);
    xs[n - 1] = range;
    ys[n - 1] = 0;
    const hMax = Math.max(...ys);

    // Vácuo (analítico).
    const rangeVac = vx0 * tVac;
    const hMaxVac = p.h0 + (vy0 * vy0) / (2 * p.g);
    const tv = linspace(0, tVac, 400);
    const speeds = sol.y.map((s) => Math.hypot(s[2], s[3]));
    if (p.v0 > 300) warnings.push('Acima de ~300 m/s o escoamento se aproxima do regime transônico e C_d deixa de ser constante.');

    return {
      plots: [
        {
          title: 'Trajetória',
          xLabel: 'x (m)',
          yLabel: 'y (m)',
          equalAxes: true,
          traces: [
            { name: 'Com arrasto (RK4)', x: decimate(xs), y: decimate(ys) },
            { name: 'Vácuo (analítico)', x: tv.map((t) => vx0 * t), y: tv.map((t) => p.h0 + vy0 * t - 0.5 * p.g * t * t), dash: true },
          ],
        },
        {
          title: 'Velocidade escalar',
          xLabel: 't (s)',
          yLabel: '|v| (m/s)',
          traces: [
            { name: 'Com arrasto', x: decimate(sol.t), y: decimate(speeds) },
            { name: 'Vácuo', x: tv, y: tv.map((t) => Math.hypot(vx0, vy0 - p.g * t)), dash: true },
          ],
        },
      ],
      summary: [
        { label: 'Alcance com arrasto', value: range, unit: 'm' },
        { label: 'Alcance no vácuo', value: rangeVac, unit: 'm' },
        { label: 'Altura máxima com arrasto', value: hMax, unit: 'm' },
        { label: 'Altura máxima no vácuo', value: hMaxVac, unit: 'm' },
        { label: 'Tempo de voo com arrasto', value: tImpact, unit: 's' },
        { label: 'Tempo de voo no vácuo', value: tVac, unit: 's' },
        { label: 'Velocidade de impacto', value: vImpact, unit: 'm/s' },
        { label: 'Velocidade terminal √(g/k)', value: k > 0 ? Math.sqrt(p.g / k) : Infinity, unit: 'm/s' },
      ].filter((s) => Number.isFinite(s.value)),
      warnings,
    };
  },
};
