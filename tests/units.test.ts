import { describe, expect, it } from 'vitest';
import { UNIT_GROUPS, analyzeDimensions, checkEquationDimensions, convertUnit } from '../src/core/units/units';

describe('conversão de unidades', () => {
  it('converte valores conhecidos', () => {
    expect(convertUnit(1, 'km/h', 'm/s').value).toBeCloseTo(1 / 3.6, 12);
    expect(convertUnit(1, 'eV', 'J').value).toBeCloseTo(1.602176634e-19, 30);
    expect(convertUnit(1, 'atm', 'Pa').value).toBeCloseTo(101325, 6);
    expect(convertUnit(1, 'lightyear', 'm').value).toBe(9460730472580800);
    expect(convertUnit(1, 'parsec', 'lightyear').value).toBeCloseTo(3.26156, 5);
    expect(convertUnit(1, 'kcal', 'J').value).toBeCloseTo(4184, 9);
  });
  it('converte temperaturas com deslocamento', () => {
    expect(convertUnit(100, 'degC', 'degF').value).toBeCloseTo(212, 10);
    expect(convertUnit(0, 'degC', 'K').value).toBeCloseTo(273.15, 10);
    expect(convertUnit(0, 'degC', 'K').factor).toBeUndefined();
  });
  it('rejeita dimensões incompatíveis e unidades desconhecidas', () => {
    expect(() => convertUnit(1, 'm', 's')).toThrow(/incompatíveis/);
    expect(() => convertUnit(1, 'xyz', 'm')).toThrow(/desconhecida/);
  });
  it('todas as unidades da interface são válidas e conversíveis dentro do grupo', () => {
    for (const g of UNIT_GROUPS) for (const u of g.units) expect(() => convertUnit(1, u, g.units[0])).not.toThrow();
  });
});

describe('análise dimensional', () => {
  it('reconhece energia', () => {
    const a = analyzeDimensions('0.5 * 2 kg * (3 m/s)^2');
    expect(a.dimensionText).toBe('M L^2 T^-2');
    expect(a.matches.map((m) => m.unit)).toContain('J');
    expect(a.siText).toBe('9 kg m^2 / s^2');
  });
  it('verifica equações', () => {
    expect(checkEquationDimensions('E = m*c^2', { E: 'J', m: 'kg', c: 'm/s' }).consistent).toBe(true);
    expect(checkEquationDimensions('E = m*c', { E: 'J', m: 'kg', c: 'm/s' }).consistent).toBe(false);
    expect(checkEquationDimensions('T = 2*pi*sqrt(L/g)', { T: 's', L: 'm', g: 'm/s^2' }).consistent).toBe(true);
    expect(checkEquationDimensions('F = q*v*B', { F: 'N', q: 'C', v: 'm/s', B: 'T' }).consistent).toBe(true);
  });
  it('acusa soma de grandezas diferentes', () => {
    expect(() => checkEquationDimensions('x = a + b', { x: 'm', a: 'm', b: 's' })).toThrow(/Lado direito/);
  });
});
