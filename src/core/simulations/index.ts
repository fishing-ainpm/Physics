import { chargedParticleModel } from './models/chargedParticle';
import { cosmologyModel } from './models/cosmology';
import { pendulumModel } from './models/pendulum';
import { projectileModel } from './models/projectile';
import { quantumBoxModel } from './models/quantumBox';
import { relativisticRocketModel } from './models/relativity';
import { idealGasModel, maxwellModel } from './models/thermo';
import type { SimulationModel } from './types';

/**
 * Registro de modelos. Para adicionar um novo modelo físico, crie um arquivo
 * em ./models que exporte um SimulationModel e inclua-o nesta lista.
 */
export const SIMULATIONS: SimulationModel[] = [
  projectileModel,
  pendulumModel,
  relativisticRocketModel,
  quantumBoxModel,
  cosmologyModel,
  maxwellModel,
  idealGasModel,
  chargedParticleModel,
];

export function getSimulation(id: string): SimulationModel | undefined {
  return SIMULATIONS.find((s) => s.id === id);
}

export * from './types';
