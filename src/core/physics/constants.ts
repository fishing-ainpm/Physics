/**
 * Constantes físicas em unidades SI.
 *
 * Fonte: CODATA 2018 (NIST, https://physics.nist.gov/cuu/Constants/) e
 * definições do SI revisado em 2019. Valores marcados como "exato" são
 * definidos por convenção. Constantes astronômicas: IAU 2012/2015.
 */
export interface PhysicalConstant {
  /** Símbolo usado nas expressões (identificador válido no mathjs). */
  symbol: string;
  name: string;
  value: number;
  unit: string;
  /** Incerteza padrão relativa (0 = exato). */
  relUncertainty: number;
  tex: string;
  source: string;
}

const h = 6.62607015e-34;
const NA = 6.02214076e23;
const kB = 1.380649e-23;

export const CONSTANTS: PhysicalConstant[] = [
  { symbol: 'c', name: 'Velocidade da luz no vácuo', value: 299792458, unit: 'm/s', relUncertainty: 0, tex: 'c', source: 'SI (exato)' },
  { symbol: 'G', name: 'Constante gravitacional', value: 6.6743e-11, unit: 'm^3/(kg*s^2)', relUncertainty: 2.2e-5, tex: 'G', source: 'CODATA 2018' },
  { symbol: 'h', name: 'Constante de Planck', value: h, unit: 'J*s', relUncertainty: 0, tex: 'h', source: 'SI (exato)' },
  { symbol: 'hbar', name: 'Constante de Planck reduzida', value: h / (2 * Math.PI), unit: 'J*s', relUncertainty: 0, tex: '\\hbar', source: 'SI (exato)' },
  { symbol: 'qe', name: 'Carga elementar', value: 1.602176634e-19, unit: 'C', relUncertainty: 0, tex: 'e', source: 'SI (exato)' },
  { symbol: 'kB', name: 'Constante de Boltzmann', value: kB, unit: 'J/K', relUncertainty: 0, tex: 'k_B', source: 'SI (exato)' },
  { symbol: 'NA', name: 'Constante de Avogadro', value: NA, unit: '1/mol', relUncertainty: 0, tex: 'N_A', source: 'SI (exato)' },
  { symbol: 'R', name: 'Constante dos gases', value: NA * kB, unit: 'J/(mol*K)', relUncertainty: 0, tex: 'R', source: 'SI (exato, N_A·k_B)' },
  { symbol: 'me', name: 'Massa do elétron', value: 9.1093837015e-31, unit: 'kg', relUncertainty: 3.0e-10, tex: 'm_e', source: 'CODATA 2018' },
  { symbol: 'mp', name: 'Massa do próton', value: 1.67262192369e-27, unit: 'kg', relUncertainty: 3.1e-10, tex: 'm_p', source: 'CODATA 2018' },
  { symbol: 'mn', name: 'Massa do nêutron', value: 1.67492749804e-27, unit: 'kg', relUncertainty: 5.7e-10, tex: 'm_n', source: 'CODATA 2018' },
  { symbol: 'amu', name: 'Unidade de massa atômica', value: 1.6605390666e-27, unit: 'kg', relUncertainty: 3.0e-10, tex: 'u', source: 'CODATA 2018' },
  { symbol: 'eps0', name: 'Permissividade do vácuo', value: 8.8541878128e-12, unit: 'F/m', relUncertainty: 1.5e-10, tex: '\\varepsilon_0', source: 'CODATA 2018' },
  { symbol: 'mu0', name: 'Permeabilidade do vácuo', value: 1.25663706212e-6, unit: 'N/A^2', relUncertainty: 1.5e-10, tex: '\\mu_0', source: 'CODATA 2018' },
  { symbol: 'alpha', name: 'Constante de estrutura fina', value: 7.2973525693e-3, unit: '', relUncertainty: 1.5e-10, tex: '\\alpha', source: 'CODATA 2018' },
  { symbol: 'sigmaSB', name: 'Constante de Stefan–Boltzmann', value: 5.670374419e-8, unit: 'W/(m^2*K^4)', relUncertainty: 0, tex: '\\sigma', source: 'CODATA 2018 (exato)' },
  { symbol: 'bWien', name: 'Constante de deslocamento de Wien', value: 2.897771955e-3, unit: 'm*K', relUncertainty: 0, tex: 'b', source: 'CODATA 2018 (exato)' },
  { symbol: 'a0', name: 'Raio de Bohr', value: 5.29177210903e-11, unit: 'm', relUncertainty: 1.5e-10, tex: 'a_0', source: 'CODATA 2018' },
  { symbol: 'g0', name: 'Gravidade padrão', value: 9.80665, unit: 'm/s^2', relUncertainty: 0, tex: 'g_0', source: 'CGPM 1901 (exato)' },
  { symbol: 'eV', name: 'Elétron-volt', value: 1.602176634e-19, unit: 'J', relUncertainty: 0, tex: '\\mathrm{eV}', source: 'SI (exato)' },
  { symbol: 'au', name: 'Unidade astronômica', value: 149597870700, unit: 'm', relUncertainty: 0, tex: '\\mathrm{au}', source: 'IAU 2012 (exato)' },
  { symbol: 'pc', name: 'Parsec', value: 3.0856775814913673e16, unit: 'm', relUncertainty: 0, tex: '\\mathrm{pc}', source: 'IAU 2015 (exato)' },
  { symbol: 'ly', name: 'Ano-luz', value: 9.4607304725808e15, unit: 'm', relUncertainty: 0, tex: '\\mathrm{ly}', source: 'IAU (exato, ano juliano)' },
  { symbol: 'Msun', name: 'Massa solar nominal', value: 1.98847e30, unit: 'kg', relUncertainty: 4.6e-5, tex: 'M_\\odot', source: 'IAU 2015 (GM☉/G)' },
];

const BY_SYMBOL = new Map(CONSTANTS.map((k) => [k.symbol, k]));

export function getConstant(symbol: string): PhysicalConstant {
  const k = BY_SYMBOL.get(symbol);
  if (!k) throw new Error(`Constante desconhecida: ${symbol}`);
  return k;
}

/** Valor numérico SI de uma constante. */
export const K = (symbol: string): number => getConstant(symbol).value;

/** Escopo numérico (valores SI puros) para uso no avaliador de expressões. */
export function constantsScope(): Record<string, number> {
  return Object.fromEntries(CONSTANTS.map((k) => [k.symbol, k.value]));
}
