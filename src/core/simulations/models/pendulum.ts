import { agm, crossing, rk4 } from '../integrators';
import type { SimulationModel } from '../types';
import { decimate } from '../util';

/** Período exato do pêndulo simples sem amortecimento: T = 2π√(L/g) / AGM(1, cos(θ₀/2)). */
export function exactPendulumPeriod(L: number, g: number, theta0: number): number {
  return (2 * Math.PI * Math.sqrt(L / g)) / agm(1, Math.cos(theta0 / 2));
}

export const pendulumModel: SimulationModel = {
  id: 'pendulum',
  area: 'mecanica',
  name: 'Pêndulo simples não linear',
  description: 'Resolve a equação completa do pêndulo (sem aproximar sen θ ≈ θ), com amortecimento opcional, e compara com a solução linear.',
  equations: [
    '\\ddot\\theta = -\\dfrac{g}{L}\\sin\\theta - b\\,\\dot\\theta',
    'T_0 = 2\\pi\\sqrt{L/g}\\quad(\\text{pequenas oscilações})',
    'T = \\dfrac{2\\pi\\sqrt{L/g}}{\\mathrm{AGM}\\left(1, \\cos\\frac{\\theta_0}{2}\\right)}\\quad(\\text{exato}, b = 0)',
  ],
  method: 'Runge–Kutta de 4ª ordem com passo T₀/2000; período medido por cruzamentos de θ = 0.',
  assumptions: ['Massa pontual, fio rígido e sem massa', 'Amortecimento viscoso linear (b·θ̇)', 'Oscilação plana'],
  limitations: ['Amortecimento real pode ser quadrático na velocidade', 'θ₀ = 180° é um equilíbrio instável (não permitido)'],
  references: ['Goldstein, Classical Mechanics', 'Período exato via integral elíptica completa K(k), k = sen(θ₀/2)'],
  parameters: [
    { key: 'L', label: 'Comprimento', unit: 'm', default: 1, min: 0.01, max: 1000, step: 0.01 },
    { key: 'g', label: 'Gravidade', unit: 'm/s²', default: 9.81, min: 0.01, max: 100, step: 0.01 },
    { key: 'theta0', label: 'Amplitude inicial θ₀', unit: '°', default: 60, min: 0.1, max: 179, step: 0.1 },
    { key: 'b', label: 'Amortecimento b', unit: '1/s', default: 0, min: 0, max: 10, step: 0.01 },
    { key: 'periods', label: 'Duração (em períodos T₀)', unit: '', default: 5, min: 1, max: 100, step: 1 },
  ],
  run(p) {
    const th0 = (p.theta0 * Math.PI) / 180;
    const w0 = Math.sqrt(p.g / p.L);
    const T0 = (2 * Math.PI) / w0;
    const tEnd = p.periods * T0;
    const sol = rk4((_t, [th, om]) => [om, -w0 * w0 * Math.sin(th) - p.b * om], [th0, 0], 0, tEnd, T0 / 2000);
    const th = sol.y.map((s) => s[0]);
    const om = sol.y.map((s) => s[1]);
    const warnings: string[] = [];

    // Período medido: intervalo médio entre cruzamentos descendentes de θ = 0.
    const downs: number[] = [];
    for (let i = 1; i < th.length; i++) {
      if (th[i - 1] > 0 && th[i] <= 0) downs.push(crossing(sol.t[i - 1], th[i - 1], sol.t[i], th[i]));
    }
    const measured = downs.length >= 2 ? (downs[downs.length - 1] - downs[0]) / (downs.length - 1) : NaN;
    if (!Number.isFinite(measured)) warnings.push('Poucas oscilações completas para medir o período (amortecimento alto ou duração curta).');

    const energy = (i: number) => 0.5 * p.L * p.L * om[i] * om[i] + p.g * p.L * (1 - Math.cos(th[i])); // por unidade de massa
    const e0 = energy(0);
    const drift = Math.abs(energy(th.length - 1) - e0) / e0;
    const deg = (r: number) => (r * 180) / Math.PI;

    const summary = [
      { label: 'Período linear T₀', value: T0, unit: 's' },
      { label: 'Período medido (simulação)', value: measured, unit: 's' },
    ];
    if (p.b === 0) {
      const exact = exactPendulumPeriod(p.L, p.g, th0);
      summary.push({ label: 'Período exato (integral elíptica)', value: exact, unit: 's' });
      summary.push({ label: 'Desvio T/T₀ − 1', value: (exact / T0 - 1) * 100, unit: '%' });
      summary.push({ label: 'Deriva relativa de energia (numérica)', value: drift, unit: '' });
    } else {
      summary.push({ label: 'Energia final / inicial', value: energy(th.length - 1) / e0, unit: '' });
    }

    return {
      plots: [
        {
          title: 'Ângulo em função do tempo',
          xLabel: 't (s)',
          yLabel: 'θ (graus)',
          traces: [
            { name: 'Não linear (RK4)', x: decimate(sol.t), y: decimate(th.map(deg)) },
            {
              name: 'Linear (sen θ ≈ θ, analítico)',
              x: decimate(sol.t),
              y: decimate(
                sol.t.map((t) => {
                  const wd2 = w0 * w0 - (p.b * p.b) / 4;
                  if (wd2 <= 0) return NaN;
                  const wd = Math.sqrt(wd2);
                  // Solução linear com θ(0) = θ₀ e θ̇(0) = 0.
                  return deg(th0 * Math.exp((-p.b * t) / 2) * (Math.cos(wd * t) + (p.b / (2 * wd)) * Math.sin(wd * t)));
                }),
              ).map((v) => (Number.isFinite(v) ? v : null)),
              dash: true,
            },
          ],
        },
        {
          title: 'Espaço de fase',
          xLabel: 'θ (graus)',
          yLabel: 'ω (rad/s)',
          traces: [{ name: 'Trajetória', x: decimate(th.map(deg)), y: decimate(om) }],
        },
      ],
      summary: summary.filter((s) => Number.isFinite(s.value)),
      warnings,
    };
  },
};
