/**
 * Conversão de unidades e análise dimensional, sobre o sistema de unidades
 * do mathjs. As dimensões seguem as grandezas de base do SI.
 */
import type { Unit } from 'mathjs';
import { MathError, math, parseExpression, splitEquation, translateError } from '../math/engine';

/** Ordem das dimensões de base no mathjs (Unit.BASE_DIMENSIONS). */
const BASE_DIMENSIONS = ['MASS', 'LENGTH', 'TIME', 'CURRENT', 'TEMPERATURE', 'LUMINOUS_INTENSITY', 'AMOUNT_OF_SUBSTANCE', 'ANGLE', 'BIT'] as const;

const DIM_INFO: Record<string, { symbol: string; si: string; name: string }> = {
  MASS: { symbol: 'M', si: 'kg', name: 'massa' },
  LENGTH: { symbol: 'L', si: 'm', name: 'comprimento' },
  TIME: { symbol: 'T', si: 's', name: 'tempo' },
  CURRENT: { symbol: 'I', si: 'A', name: 'corrente elétrica' },
  TEMPERATURE: { symbol: 'Θ', si: 'K', name: 'temperatura' },
  LUMINOUS_INTENSITY: { symbol: 'J', si: 'cd', name: 'intensidade luminosa' },
  AMOUNT_OF_SUBSTANCE: { symbol: 'N', si: 'mol', name: 'quantidade de substância' },
  ANGLE: { symbol: 'A', si: 'rad', name: 'ângulo' },
  BIT: { symbol: 'B', si: 'bit', name: 'informação' },
};

/** Unidades derivadas nomeadas, usadas para reconhecer o resultado. */
const NAMED_UNITS: [string, string][] = [
  ['N', 'força'],
  ['J', 'energia'],
  ['W', 'potência'],
  ['Pa', 'pressão'],
  ['C', 'carga elétrica'],
  ['V', 'potencial elétrico'],
  ['ohm', 'resistência'],
  ['F', 'capacitância'],
  ['T', 'campo magnético'],
  ['Wb', 'fluxo magnético'],
  ['H', 'indutância'],
  ['Hz', 'frequência'],
  ['m/s', 'velocidade'],
  ['m/s^2', 'aceleração'],
  ['kg*m/s', 'momento linear'],
  ['J*s', 'ação / momento angular'],
  ['kg/m^3', 'densidade'],
  ['J/K', 'entropia / capacidade térmica'],
];

export type DimensionVector = Record<string, number>;

export interface DimensionAnalysis {
  /** Valor formatado, ex.: "9 J". */
  valueText: string;
  /** Valor em unidades SI de base, ex.: "9 kg m^2 / s^2". */
  siText: string;
  dimensions: DimensionVector;
  /** Fórmula dimensional, ex.: "M L^2 T^-2". */
  dimensionText: string;
  /** Grandezas nomeadas compatíveis (ex.: J – energia). */
  matches: { unit: string; quantity: string }[];
  dimensionless: boolean;
}

function isUnit(v: unknown): v is Unit {
  return !!v && typeof v === 'object' && (v as { type?: string }).type === 'Unit';
}

function dimensionsOf(value: unknown): DimensionVector {
  const out: DimensionVector = {};
  if (isUnit(value)) {
    const dims = (value as unknown as { dimensions: number[] }).dimensions;
    BASE_DIMENSIONS.forEach((name, i) => {
      // No SI o radiano é adimensional (rad = m/m); o mathjs o trata como base.
      if (name === 'ANGLE') return;
      const p = dims[i] ?? 0;
      if (Math.abs(p) > 1e-12) out[name] = Math.round(p * 1e6) / 1e6;
    });
  }
  return out;
}

function fmtPower(base: string, p: number) {
  return p === 1 ? base : `${base}^${p}`;
}

export function dimensionFormula(d: DimensionVector): string {
  const parts = BASE_DIMENSIONS.filter((k) => d[k]).map((k) => fmtPower(DIM_INFO[k].symbol, d[k]));
  return parts.length ? parts.join(' ') : '1 (adimensional)';
}

export function siBaseText(d: DimensionVector): string {
  const num = BASE_DIMENSIONS.filter((k) => (d[k] ?? 0) > 0).map((k) => fmtPower(DIM_INFO[k].si, d[k]));
  const den = BASE_DIMENSIONS.filter((k) => (d[k] ?? 0) < 0).map((k) => fmtPower(DIM_INFO[k].si, -d[k]));
  if (!num.length && !den.length) return '';
  const n = num.length ? num.join(' ') : '1';
  if (!den.length) return n;
  return `${n} / ${den.length > 1 ? `(${den.join(' ')})` : den[0]}`;
}

export function sameDimensions(a: DimensionVector, b: DimensionVector): boolean {
  return BASE_DIMENSIONS.every((k) => Math.abs((a[k] ?? 0) - (b[k] ?? 0)) < 1e-9);
}

function evaluateQuantity(expr: string, scope: Record<string, unknown> = {}): unknown {
  const node = parseExpression(expr);
  try {
    return node.compile().evaluate({ ...scope });
  } catch (err) {
    throw translateError(err);
  }
}

/** Analisa as dimensões de uma expressão com unidades, ex.: "0.5 * 2 kg * (3 m/s)^2". */
export function analyzeDimensions(expr: string, scope: Record<string, unknown> = {}): DimensionAnalysis {
  const value = evaluateQuantity(expr, scope);
  if (!isUnit(value) && typeof value !== 'number') throw new MathError('A expressão deve resultar em um número ou grandeza com unidade.');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new MathError('Resultado não finito.');
  const dimensions = dimensionsOf(value);
  const dimensionless = Object.keys(dimensions).length === 0;
  let siText: string;
  if (isUnit(value)) {
    const base = siBaseText(dimensions);
    const si = (value as unknown as { toSI: () => Unit }).toSI();
    const siNumber = (si as unknown as { value: number | null }).value;
    siText = siNumber === null ? base : `${math.format(siNumber, { precision: 10 })} ${base}`.trim();
  } else {
    siText = math.format(value, { precision: 10 });
  }
  const matches = dimensionless
    ? []
    : NAMED_UNITS.filter(([u]) => sameDimensions(dimensionsOf(math.unit(u)), dimensions)).map(([unit, quantity]) => ({ unit, quantity }));
  return {
    valueText: math.format(value as never, { precision: 10 }),
    siText,
    dimensions,
    dimensionText: dimensionFormula(dimensions),
    matches,
    dimensionless,
  };
}

export interface ConversionResult {
  value: number;
  text: string;
  /** Fator multiplicativo (ausente para escalas com deslocamento, ex.: °C). */
  factor?: number;
}

/** Converte um valor numérico entre unidades compatíveis. */
export function convertUnit(value: number, from: string, to: string): ConversionResult {
  if (!Number.isFinite(value)) throw new MathError('Informe um valor numérico finito.');
  if (!from.trim() || !to.trim()) throw new MathError('Informe as unidades de origem e de destino.');
  let source: Unit;
  try {
    source = math.unit(value, from.trim());
  } catch {
    throw new MathError(`Unidade de origem desconhecida: "${from}".`);
  }
  let target: Unit;
  try {
    target = math.unit(to.trim());
  } catch {
    throw new MathError(`Unidade de destino desconhecida: "${to}".`);
  }
  if (!sameDimensions(dimensionsOf(source), dimensionsOf(target))) {
    throw new MathError(
      `Dimensões incompatíveis: ${dimensionFormula(dimensionsOf(source))} não pode ser convertido em ${dimensionFormula(dimensionsOf(target))}.`,
    );
  }
  try {
    const converted = source.to(to.trim());
    const out = converted.toNumber(to.trim());
    const result: ConversionResult = { value: out, text: `${math.format(out, { precision: 12 })} ${to.trim()}` };
    const offset = (u: Unit) => (u as unknown as { units: { unit: { offset: number } }[] }).units.some((x) => x.unit.offset !== 0);
    if (!offset(source) && !offset(target)) result.factor = math.unit(1, from.trim()).toNumber(to.trim());
    return result;
  } catch (err) {
    throw translateError(err);
  }
}

export interface EquationDimensionCheck {
  consistent: boolean;
  lhs: DimensionAnalysis;
  rhs: DimensionAnalysis;
  message: string;
}

/**
 * Verifica a consistência dimensional de uma equação "lhs = rhs", atribuindo
 * a cada variável a unidade informada (ou adimensional, se vazia).
 * Ex.: checkEquationDimensions("E = m*c^2", {E: "J", m: "kg", c: "m/s"}).
 */
export function checkEquationDimensions(equation: string, variableUnits: Record<string, string>): EquationDimensionCheck {
  const eq = splitEquation(equation);
  if (!eq) throw new MathError('Escreva uma equação com "=", ex.: E = m*c^2.');
  const names = Object.keys(variableUnits);
  for (const name of names) {
    const u = variableUnits[name].trim();
    if (u && u !== '1') {
      try {
        math.unit(1, u);
      } catch {
        throw new MathError(`Unidade inválida para ${name}: "${u}".`);
      }
    }
  }
  // As dimensões não dependem das magnitudes, mas alguns valores caem fora do
  // domínio (ex.: 1/√(1 − v²/c²) com v = c). Tentamos algumas atribuições.
  const magnitudeSets: ((k: number) => number)[] = [() => 1, (k) => 1 / (k + 2), (k) => k + 2, (k) => 0.1 + ((k * 0.6180339887) % 1)];
  let lhs: DimensionAnalysis | undefined;
  let rhs: DimensionAnalysis | undefined;
  let lastError: Error | undefined;
  for (const mag of magnitudeSets) {
    const scope: Record<string, unknown> = {};
    names.forEach((name, k) => {
      const u = variableUnits[name].trim();
      scope[name] = !u || u === '1' ? mag(k) : math.unit(mag(k), u);
    });
    try {
      try {
        lhs = analyzeDimensions(eq.lhs, scope);
      } catch (err) {
        throw new MathError(`Lado esquerdo: ${(err as Error).message}`);
      }
      try {
        rhs = analyzeDimensions(eq.rhs, scope);
      } catch (err) {
        throw new MathError(`Lado direito: ${(err as Error).message}`);
      }
      break;
    } catch (err) {
      lastError = err as Error;
      lhs = rhs = undefined;
      // Unidades incompatíveis numa soma não dependem da magnitude: aborta já.
      if (/unidades|Símbolo indefinido/i.test(lastError.message)) throw lastError;
    }
  }
  if (!lhs || !rhs) throw lastError ?? new MathError('Não foi possível analisar a equação.');
  const consistent = sameDimensions(lhs.dimensions, rhs.dimensions);
  const message = consistent
    ? `Dimensionalmente consistente: ambos os lados têm dimensão ${lhs.dimensionText}.`
    : `Inconsistente: lado esquerdo ${lhs.dimensionText}, lado direito ${rhs.dimensionText}.`;
  return { consistent, lhs, rhs, message };
}

/** Grupos de unidades comuns para a interface de conversão. */
export const UNIT_GROUPS: { name: string; units: string[] }[] = [
  { name: 'Comprimento', units: ['m', 'km', 'cm', 'mm', 'um', 'nm', 'angstrom', 'inch', 'ft', 'mi', 'au', 'lightyear', 'parsec'] },
  { name: 'Massa', units: ['kg', 'g', 'mg', 'tonne', 'lb', 'u'] },
  { name: 'Tempo', units: ['s', 'ms', 'us', 'ns', 'min', 'h', 'day', 'week', 'year'] },
  { name: 'Velocidade', units: ['m/s', 'km/h', 'mi/h', 'knot'] },
  { name: 'Energia', units: ['J', 'kJ', 'eV', 'keV', 'MeV', 'GeV', 'cal', 'kcal', 'kWh', 'erg', 'BTU'] },
  { name: 'Potência', units: ['W', 'kW', 'MW', 'hp'] },
  { name: 'Força', units: ['N', 'kN', 'dyn', 'lbf'] },
  { name: 'Pressão', units: ['Pa', 'kPa', 'bar', 'atm', 'mmHg', 'psi', 'torr'] },
  { name: 'Temperatura', units: ['K', 'degC', 'degF', 'degR'] },
  { name: 'Ângulo', units: ['rad', 'deg', 'grad', 'arcmin', 'arcsec'] },
  { name: 'Carga elétrica', units: ['C', 'mC', 'uC', 'Ah'] },
  { name: 'Corrente elétrica', units: ['A', 'mA', 'uA'] },
  { name: 'Campo magnético', units: ['T', 'mT', 'gauss'] },
];
