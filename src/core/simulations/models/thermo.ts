import { MathError, integrate } from '../../math/engine';
import { K } from '../../physics/constants';
import type { SimulationModel } from '../types';
import { linspace } from '../util';

/** Distribuição de Maxwell–Boltzmann das velocidades (densidade em s/m). */
export function maxwellBoltzmann(v: number, molarMass: number, T: number): number {
  const m = molarMass / K('NA');
  const a = m / (2 * K('kB') * T);
  return 4 * Math.PI * (a / Math.PI) ** 1.5 * v * v * Math.exp(-a * v * v);
}

export function characteristicSpeeds(molarMass: number, T: number) {
  const kT_m = (K('kB') * T * K('NA')) / molarMass;
  return {
    vp: Math.sqrt(2 * kT_m),
    vmean: Math.sqrt((8 * kT_m) / Math.PI),
    vrms: Math.sqrt(3 * kT_m),
  };
}

export const maxwellModel: SimulationModel = {
  id: 'maxwell-boltzmann',
  area: 'termodinamica',
  name: 'Distribuição de velocidades de Maxwell–Boltzmann',
  description: 'Distribuição de velocidades moleculares de um gás ideal em equilíbrio térmico, comparando duas temperaturas.',
  equations: [
    'f(v) = 4\\pi\\left(\\dfrac{m}{2\\pi k_B T}\\right)^{3/2} v^2\\, e^{-m v^2 / 2 k_B T}',
    'v_p = \\sqrt{\\dfrac{2k_BT}{m}},\\quad \\bar v = \\sqrt{\\dfrac{8k_BT}{\\pi m}},\\quad v_{rms} = \\sqrt{\\dfrac{3k_BT}{m}}',
  ],
  method: 'Avaliação analítica; normalização verificada por integração numérica (Simpson adaptativo).',
  assumptions: ['Gás ideal clássico em equilíbrio térmico', 'Moléculas idênticas de massa m = M/N_A'],
  limitations: ['Não vale para gases degenerados (efeitos quânticos a baixa T ou alta densidade)', 'Ignora interações intermoleculares'],
  references: ['Maxwell (1860); Boltzmann (1872)', 'Reif, Fundamentals of Statistical and Thermal Physics, §7.10'],
  parameters: [
    { key: 'M', label: 'Massa molar', unit: 'g/mol', default: 28.0134, min: 0.001, max: 1000, step: 0.01, help: 'N₂ = 28,01; He = 4,003; O₂ = 32,00' },
    { key: 'T1', label: 'Temperatura 1', unit: 'K', default: 300, min: 0.01, max: 1e6, step: 1 },
    { key: 'T2', label: 'Temperatura 2', unit: 'K', default: 1000, min: 0.01, max: 1e6, step: 1 },
  ],
  run(p) {
    const M = p.M / 1000;
    const s1 = characteristicSpeeds(M, p.T1);
    const s2 = characteristicSpeeds(M, p.T2);
    const vmax = 4 * Math.max(s1.vp, s2.vp);
    const vs = linspace(0, vmax, 400);
    const norm = integrate((v) => maxwellBoltzmann(v, M, p.T1), 0, 12 * s1.vp, 1e-12).value;
    return {
      plots: [
        {
          title: 'Distribuição de velocidades f(v)',
          xLabel: 'v (m/s)',
          yLabel: 'f(v) (s/m)',
          traces: [
            { name: `T = ${p.T1} K`, x: vs, y: vs.map((v) => maxwellBoltzmann(v, M, p.T1)) },
            { name: `T = ${p.T2} K`, x: vs, y: vs.map((v) => maxwellBoltzmann(v, M, p.T2)) },
          ],
        },
      ],
      summary: [
        { label: `v mais provável (T₁)`, value: s1.vp, unit: 'm/s' },
        { label: `v média (T₁)`, value: s1.vmean, unit: 'm/s' },
        { label: `v rms (T₁)`, value: s1.vrms, unit: 'm/s' },
        { label: `v rms (T₂)`, value: s2.vrms, unit: 'm/s' },
        { label: 'Normalização ∫f dv (T₁, deve ser 1)', value: norm, unit: '' },
      ],
      warnings: [],
    };
  },
};

export const idealGasModel: SimulationModel = {
  id: 'ideal-gas-processes',
  area: 'termodinamica',
  name: 'Processos de um gás ideal (diagrama P–V)',
  description: 'Compara expansões isotérmica, adiabática e isobárica de um gás ideal entre os mesmos volumes, com o trabalho realizado em cada caso.',
  equations: [
    'PV = nRT',
    '\\text{isotérmico: } W = nRT_1\\ln(V_2/V_1)',
    '\\text{adiabático: } PV^\\gamma = \\text{const},\\; W = \\dfrac{P_1V_1 - P_2V_2}{\\gamma - 1}',
    '\\text{isobárico: } W = P_1 (V_2 - V_1)',
  ],
  method: 'Fórmulas analíticas; trabalho conferido por integração numérica de ∫P dV.',
  assumptions: ['Gás ideal', 'Processos quase-estáticos (reversíveis)', 'γ = C_p/C_v constante'],
  limitations: ['Gases reais desviam a altas pressões', 'Processos reais rápidos são irreversíveis'],
  references: ['Callen, Thermodynamics, cap. 4', 'γ = 5/3 (monoatômico), 7/5 (diatômico)'],
  parameters: [
    { key: 'n', label: 'Quantidade de substância', unit: 'mol', default: 1, min: 1e-6, max: 1e6, step: 0.1 },
    { key: 'T1', label: 'Temperatura inicial', unit: 'K', default: 300, min: 0.01, max: 1e5, step: 1 },
    { key: 'V1', label: 'Volume inicial', unit: 'L', default: 10, min: 1e-6, max: 1e9, step: 0.1 },
    { key: 'V2', label: 'Volume final', unit: 'L', default: 30, min: 1e-6, max: 1e9, step: 0.1 },
    { key: 'gamma', label: 'Índice adiabático γ', unit: '', default: 1.4, min: 1.0001, max: 3, step: 0.01 },
  ],
  run(p) {
    if (p.V1 === p.V2) throw new MathError('Os volumes inicial e final devem ser diferentes.');
    const R = K('R');
    const V1 = p.V1 / 1000;
    const V2 = p.V2 / 1000;
    const P1 = (p.n * R * p.T1) / V1;
    const Piso = (V: number) => (p.n * R * p.T1) / V;
    const Pad = (V: number) => P1 * (V1 / V) ** p.gamma;
    const P2ad = Pad(V2);
    const T2ad = (P2ad * V2) / (p.n * R);
    const Wiso = p.n * R * p.T1 * Math.log(V2 / V1);
    const Wad = (P1 * V1 - P2ad * V2) / (p.gamma - 1);
    const Wbar = P1 * (V2 - V1);
    const WisoNum = integrate(Piso, V1, V2, 1e-9 * Math.abs(Wiso)).value;
    const WadNum = integrate(Pad, V1, V2, 1e-9 * Math.abs(Wad)).value;
    const Vs = linspace(Math.min(V1, V2), Math.max(V1, V2), 200);
    const L = Vs.map((v) => v * 1000);
    const kPa = (x: number) => x / 1000;
    return {
      plots: [
        {
          title: 'Diagrama P–V',
          xLabel: 'V (L)',
          yLabel: 'P (kPa)',
          traces: [
            { name: 'Isotérmico', x: L, y: Vs.map((v) => kPa(Piso(v))) },
            { name: 'Adiabático', x: L, y: Vs.map((v) => kPa(Pad(v))) },
            { name: 'Isobárico', x: L, y: Vs.map(() => kPa(P1)), dash: true },
          ],
        },
      ],
      summary: [
        { label: 'Pressão inicial P₁', value: kPa(P1), unit: 'kPa' },
        { label: 'Trabalho isotérmico', value: Wiso, unit: 'J' },
        { label: 'Trabalho isotérmico (∫P dV numérico)', value: WisoNum, unit: 'J' },
        { label: 'Trabalho adiabático', value: Wad, unit: 'J' },
        { label: 'Trabalho adiabático (∫P dV numérico)', value: WadNum, unit: 'J' },
        { label: 'Trabalho isobárico', value: Wbar, unit: 'J' },
        { label: 'Temperatura final adiabática', value: T2ad, unit: 'K' },
        { label: 'Temperatura final isobárica', value: (p.T1 * V2) / V1, unit: 'K' },
      ],
      warnings: [],
    };
  },
};
