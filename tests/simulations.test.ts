import { describe, expect, it } from 'vitest';
import { K } from '../src/core/physics/constants';
import { SIMULATIONS, defaultParams, getSimulation, runSimulation, validateParams } from '../src/core/simulations';
import { agm, rk4 } from '../src/core/simulations/integrators';
import { borisPush } from '../src/core/simulations/models/chargedParticle';
import { comovingDistance, cosmicTime, hubbleSI } from '../src/core/simulations/models/cosmology';
import { exactPendulumPeriod } from '../src/core/simulations/models/pendulum';
import { boxEnergy } from '../src/core/simulations/models/quantumBox';
import { hyperbolicMotion } from '../src/core/simulations/models/relativity';
import { characteristicSpeeds } from '../src/core/simulations/models/thermo';
import { MPC_IN_M, SECONDS_PER_YEAR } from '../src/core/simulations/util';

const summary = (id: string, params: Record<string, number> = {}) => {
  const m = getSimulation(id)!;
  const r = runSimulation(m, { ...defaultParams(m), ...params });
  return { r, get: (label: string) => r.summary.find((s) => s.label.startsWith(label))!.value };
};

describe('integradores', () => {
  it('RK4 reproduz decaimento exponencial', () => {
    const s = rk4((_t, [y]) => [-y], [1], 0, 1, 0.01);
    expect(s.y[s.y.length - 1][0]).toBeCloseTo(Math.exp(-1), 9);
  });
  it('AGM(1, √2/2) — constante de Gauss', () => {
    expect(1 / agm(1, Math.SQRT2)).toBeCloseTo(0.8346268416740731, 13);
  });
});

describe('todos os modelos', () => {
  it('rodam com os parâmetros padrão e produzem saídas finitas', () => {
    for (const m of SIMULATIONS) {
      const r = runSimulation(m, defaultParams(m));
      expect(r.plots.length, m.id).toBeGreaterThan(0);
      for (const s of r.summary) expect(Number.isFinite(s.value), `${m.id}: ${s.label}`).toBe(true);
      for (const p of r.plots) for (const t of p.traces) expect(t.x.length).toBe(t.y.length);
    }
  });
  it('validam parâmetros', () => {
    const m = getSimulation('pendulum')!;
    expect(() => validateParams(m, { ...defaultParams(m), L: -1 })).toThrow(/entre/);
    expect(() => validateParams(m, { ...defaultParams(m), L: NaN })).toThrow(/número/);
    expect(() => validateParams(getSimulation('quantum-box')!, { n1: 1.5 })).toThrow(/inteiro/);
  });
});

describe('mecânica clássica', () => {
  it('projétil sem arrasto reproduz R = v₀² sen2θ / g', () => {
    const { get } = summary('projectile', { v0: 20, angle: 30, cd: 0, g: 9.81 });
    const R = (400 * Math.sin(Math.PI / 3)) / 9.81;
    expect(get('Alcance com arrasto')).toBeCloseTo(R, 3);
    expect(get('Alcance no vácuo')).toBeCloseTo(R, 10);
  });
  it('arrasto reduz o alcance', () => {
    const { get } = summary('projectile');
    expect(get('Alcance com arrasto')).toBeLessThan(get('Alcance no vácuo'));
  });
  it('pêndulo: período medido = período exato (integral elíptica)', () => {
    const { get } = summary('pendulum', { theta0: 90, b: 0, periods: 10 });
    expect(get('Período medido')).toBeCloseTo(get('Período exato'), 5);
    // Valor tabelado: T(90°)/T₀ = 1,18034
    expect(get('Período exato') / get('Período linear')).toBeCloseTo(1.18034, 5);
  });
  it('pequenas amplitudes → T₀ = 2π√(L/g)', () => {
    // Série: T/T₀ = 1 + θ₀²/16 + ...
    expect(exactPendulumPeriod(1, 9.81, 1e-2) / (2 * Math.PI * Math.sqrt(1 / 9.81))).toBeCloseTo(1 + 1e-4 / 16, 9);
  });
});

describe('relatividade', () => {
  it('1 g por 1 ano → v ≈ 0,718 c', () => {
    const s = hyperbolicMotion(9.81, SECONDS_PER_YEAR);
    expect(s.v / K('c')).toBeCloseTo(0.7183, 3);
    expect(s.v).toBeLessThan(K('c'));
  });
  it('limite newtoniano para at ≪ c', () => {
    const s = hyperbolicMotion(1, 10);
    expect(s.v).toBeCloseTo(10, 9);
    expect(s.x).toBeCloseTo(50, 6);
    expect(s.tau).toBeCloseTo(10, 9);
  });
});

describe('mecânica quântica', () => {
  it('elétron em poço de 1 nm: E₁ ≈ 0,376 eV', () => {
    expect(boxEnergy(1, K('me'), 1e-9) / K('eV')).toBeCloseTo(0.376, 3);
    expect(boxEnergy(3, K('me'), 1e-9) / boxEnergy(1, K('me'), 1e-9)).toBeCloseTo(9, 12);
  });
  it('superposição normalizada', () => {
    const { get } = summary('quantum-box');
    expect(get('Normalização')).toBeCloseTo(1, 8);
  });
});

describe('cosmologia', () => {
  it('Einstein–de Sitter: t₀ = 2/(3H₀)', () => {
    const p = { H0: 70, Om: 1, OL: 0, Or: 0 };
    expect(cosmicTime(1, p)).toBeCloseTo(2 / (3 * hubbleSI(70)), -10);
    expect(cosmicTime(1, p) / (2 / (3 * hubbleSI(70)))).toBeCloseTo(1, 8);
  });
  it('Milne (universo vazio): t₀ = 1/H₀', () => {
    expect(cosmicTime(1, { H0: 70, Om: 0, OL: 0, Or: 0 }) * hubbleSI(70)).toBeCloseTo(1, 8);
  });
  it('EdS: D_C(z) = 2c/H₀ (1 − 1/√(1+z))', () => {
    const z = 3;
    const expected = ((2 * K('c')) / hubbleSI(70)) * (1 - 1 / Math.sqrt(1 + z));
    expect(comovingDistance(z, { H0: 70, Om: 1, OL: 0, Or: 0 }) / expected).toBeCloseTo(1, 8);
  });
  it('Planck 2018: idade ≈ 13,8 Ga', () => {
    const { get } = summary('lcdm');
    expect(get('Idade do universo')).toBeGreaterThan(13.7);
    expect(get('Idade do universo')).toBeLessThan(13.9);
  });
  it('rejeita universo sem Big Bang', () => {
    expect(() => cosmicTime(1, { H0: 70, Om: 0, OL: 1, Or: 0 })).toThrow(/infinita/);
  });
  it('unidades astronômicas consistentes', () => {
    expect(MPC_IN_M).toBeCloseTo(3.0857e22, -18);
  });
});

describe('termodinâmica', () => {
  it('N₂ a 300 K: v_rms ≈ 517 m/s', () => {
    expect(characteristicSpeeds(0.0280134, 300).vrms).toBeCloseTo(516.8, 0);
  });
  it('Maxwell–Boltzmann normalizada', () => {
    expect(summary('maxwell-boltzmann').get('Normalização')).toBeCloseTo(1, 8);
  });
  it('trabalho isotérmico analítico = numérico', () => {
    const { get } = summary('ideal-gas-processes', { n: 1, T1: 300, V1: 10, V2: 20 });
    expect(get('Trabalho isotérmico')).toBeCloseTo(8.314462618 * 300 * Math.LN2, 6);
    expect(get('Trabalho isotérmico (∫P')).toBeCloseTo(get('Trabalho isotérmico'), 4);
    expect(get('Trabalho adiabático (∫P')).toBeCloseTo(get('Trabalho adiabático'), 4);
  });
});

describe('eletromagnetismo', () => {
  it('próton em B = 1 T: T_c = 2πm/(qB) e órbita fechada', () => {
    const q = K('qe');
    const m = K('mp');
    const Tc = (2 * Math.PI * m) / (q * 1);
    const { xs, vs } = borisPush(q, m, [0, 0, 0], [0, 0, 1], [0, 0, 0], [1e5, 0, 0], Tc / 400, 400);
    const r = (m * 1e5) / (q * 1);
    const last = xs[xs.length - 1];
    expect(Math.hypot(last[0], last[1]) / r).toBeLessThan(1e-3); // volta ao início
    const maxY = Math.max(...xs.map((p) => Math.abs(p[1])));
    expect(maxY / (2 * r)).toBeCloseTo(1, 3); // diâmetro = 2 r_L
    expect(Math.hypot(...vs[vs.length - 1])).toBeCloseTo(1e5, 6); // |v| conservado
  });
  it('deriva E×B simulada = E/B', () => {
    const { get } = summary('charged-particle', { Ex: 0, Ey: 200, Bz: 0.01 });
    expect(get('Deriva E×B teórica v_x')).toBeCloseTo(2e4, 6);
    expect(get('Deriva simulada v_x') / 2e4).toBeCloseTo(1, 3);
  });
});
