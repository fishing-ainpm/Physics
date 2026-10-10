import { K } from '../../physics/constants';
import type { SimulationModel } from '../types';
import { SECONDS_PER_YEAR, linspace } from '../util';

const LY = 9.4607304725808e15;

/** Movimento hiperbólico: aceleração própria constante a, partindo do repouso. */
export function hyperbolicMotion(a: number, t: number) {
  const c = K('c');
  const s = (a * t) / c;
  const gamma = Math.sqrt(1 + s * s);
  return {
    v: (a * t) / gamma,
    // γ − 1 = s²/(γ + 1) evita cancelamento catastrófico quando at ≪ c.
    x: ((c * c) / a) * ((s * s) / (gamma + 1)),
    tau: (c / a) * Math.asinh(s),
    gamma,
  };
}

export const relativisticRocketModel: SimulationModel = {
  id: 'relativistic-rocket',
  area: 'relatividade',
  name: 'Foguete relativístico (aceleração própria constante)',
  description:
    'Compara a viagem de uma nave com aceleração própria constante segundo a relatividade restrita e segundo a mecânica newtoniana; mostra o tempo próprio vivido pela tripulação.',
  equations: [
    'v(t) = \\dfrac{a t}{\\sqrt{1 + (a t / c)^2}}',
    'x(t) = \\dfrac{c^2}{a}\\left(\\sqrt{1 + (a t/c)^2} - 1\\right)',
    '\\tau(t) = \\dfrac{c}{a}\\,\\operatorname{arsinh}\\!\\left(\\dfrac{a t}{c}\\right)',
  ],
  method: 'Solução analítica exata do movimento hiperbólico (Rindler), avaliada em 400 pontos.',
  assumptions: ['Espaço-tempo plano (sem gravidade)', 'Aceleração própria constante, movimento retilíneo, partida do repouso', 't = tempo coordenado no referencial inercial de partida'],
  limitations: ['Ignora o consumo de combustível (equação do foguete relativístico)', 'Não considera desaceleração para chegada'],
  references: ['Rindler, Relativity: Special, General and Cosmological, §3.8', 'Misner, Thorne & Wheeler, Gravitation, §6.2'],
  parameters: [
    { key: 'a', label: 'Aceleração própria', unit: 'm/s²', default: 9.81, min: 0.01, max: 1e4, step: 0.01 },
    { key: 'years', label: 'Duração (tempo coordenado)', unit: 'anos', default: 5, min: 0.01, max: 1000, step: 0.1 },
  ],
  run(p) {
    const c = K('c');
    const tEnd = p.years * SECONDS_PER_YEAR;
    const ts = linspace(0, tEnd, 400);
    const states = ts.map((t) => hyperbolicMotion(p.a, t));
    const yrs = ts.map((t) => t / SECONDS_PER_YEAR);
    const end = states[states.length - 1];
    const warnings: string[] = [];
    const newtonV = p.a * tEnd;
    if (newtonV > c) warnings.push(`A previsão newtoniana ultrapassa c (v = ${(newtonV / c).toFixed(2)} c), o que é fisicamente impossível.`);
    return {
      plots: [
        {
          title: 'Velocidade',
          xLabel: 't (anos)',
          yLabel: 'v / c',
          traces: [
            { name: 'Relativística', x: yrs, y: states.map((s) => s.v / c) },
            { name: 'Newtoniana (v = at)', x: yrs, y: ts.map((t) => (p.a * t) / c), dash: true },
          ],
        },
        {
          title: 'Distância percorrida',
          xLabel: 't (anos)',
          yLabel: 'x (anos-luz)',
          traces: [
            { name: 'Relativística', x: yrs, y: states.map((s) => s.x / LY) },
            { name: 'Newtoniana (at²/2)', x: yrs, y: ts.map((t) => (0.5 * p.a * t * t) / LY), dash: true },
          ],
        },
        {
          title: 'Tempo próprio da tripulação',
          xLabel: 't (anos, referencial de partida)',
          yLabel: 'τ (anos)',
          traces: [
            { name: 'τ(t)', x: yrs, y: states.map((s) => s.tau / SECONDS_PER_YEAR) },
            { name: 'τ = t (sem dilatação)', x: yrs, y: yrs, dash: true },
          ],
        },
      ],
      summary: [
        { label: 'Velocidade final', value: end.v / c, unit: 'c' },
        { label: 'Fator de Lorentz final γ', value: end.gamma, unit: '' },
        { label: 'Distância percorrida', value: end.x / LY, unit: 'anos-luz' },
        { label: 'Tempo próprio decorrido', value: end.tau / SECONDS_PER_YEAR, unit: 'anos' },
        { label: 'Tempo coordenado', value: p.years, unit: 'anos' },
      ],
      warnings,
    };
  },
};
