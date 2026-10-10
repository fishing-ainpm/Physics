import { MathError } from '../math/engine';
import type { AreaId } from '../physics/areas';

export interface SimParameter {
  key: string;
  label: string;
  unit: string;
  default: number;
  min: number;
  max: number;
  step: number;
  /** Se verdadeiro, só aceita inteiros. */
  integer?: boolean;
  help?: string;
}

export interface Trace {
  name: string;
  x: number[];
  y: (number | null)[];
  mode?: 'lines' | 'markers' | 'lines+markers';
  dash?: boolean;
}

export interface PlotSpec {
  title: string;
  xLabel: string;
  yLabel: string;
  traces: Trace[];
  /** Mantém escala igual nos dois eixos (trajetórias). */
  equalAxes?: boolean;
}

export interface SummaryItem {
  label: string;
  value: number;
  unit: string;
}

export interface SimulationResult {
  plots: PlotSpec[];
  summary: SummaryItem[];
  warnings: string[];
}

export interface SimulationModel {
  id: string;
  area: AreaId;
  name: string;
  description: string;
  /** Equações do modelo em LaTeX. */
  equations: string[];
  method: string;
  assumptions: string[];
  limitations: string[];
  references: string[];
  parameters: SimParameter[];
  run(params: Record<string, number>): SimulationResult;
}

export function defaultParams(model: SimulationModel): Record<string, number> {
  return Object.fromEntries(model.parameters.map((p) => [p.key, p.default]));
}

/** Valida e completa os parâmetros; lança MathError com mensagem clara. */
export function validateParams(model: SimulationModel, params: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of model.parameters) {
    const raw = params[p.key] ?? p.default;
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new MathError(`${p.label}: informe um número válido.`);
    if (value < p.min || value > p.max) throw new MathError(`${p.label} deve estar entre ${p.min} e ${p.max} ${p.unit}.`.trim());
    if (p.integer && !Number.isInteger(value)) throw new MathError(`${p.label} deve ser um número inteiro.`);
    out[p.key] = value;
  }
  return out;
}

export function runSimulation(model: SimulationModel, params: Record<string, number>): SimulationResult {
  const valid = validateParams(model, params);
  const result = model.run(valid);
  for (const item of result.summary) {
    if (!Number.isFinite(item.value)) result.warnings.push(`O valor de "${item.label}" não é finito.`);
  }
  return result;
}
