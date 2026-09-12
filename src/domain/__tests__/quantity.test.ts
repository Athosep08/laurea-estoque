import { describe, expect, it } from 'vitest';
import { formatQuantity, roundQuantity } from '../quantity';

describe('quantity', () => {
  it('arredonda resíduo de ponto flutuante', () => {
    expect(roundQuantity(0.18 * 10)).toBe(1.8);
  });

  it('formata com separador de milhar e vírgula decimal', () => {
    expect(formatQuantity(11840)).toBe('11.840');
    expect(formatQuantity(9.5)).toBe('9,5');
    expect(formatQuantity(0.18)).toBe('0,18');
  });

  it('não exibe casas decimais em números inteiros', () => {
    expect(formatQuantity(8)).toBe('8');
    expect(formatQuantity(0)).toBe('0');
  });

  it('não exibe resíduo de ponto flutuante', () => {
    expect(formatQuantity(20 - 14.000000000000002)).toBe('6');
    expect(formatQuantity(0.1 + 0.2)).toBe('0,3');
  });
});
