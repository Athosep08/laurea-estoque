import { describe, expect, it } from 'vitest';
import { centsToReais, formatBRL, multiplyCents, reaisToCents, sumCents } from '../money';

describe('money', () => {
  it('converte reais para centavos sem erro de ponto flutuante', () => {
    expect(reaisToCents(35.9)).toBe(3590);
    expect(reaisToCents(0.1 + 0.2)).toBe(30);
  });

  it('converte centavos para reais', () => {
    expect(centsToReais(3590)).toBe(35.9);
  });

  it('formata centavos como BRL', () => {
    expect(formatBRL(3590)).toBe('R$\u00a035,90');
    expect(formatBRL(0)).toBe('R$\u00a00,00');
  });

  it('multiplica centavos por quantidade arredondando para inteiro', () => {
    expect(multiplyCents(3590, 3)).toBe(10770);
    expect(multiplyCents(333, 3)).toBe(999);
  });

  it('soma uma lista de centavos', () => {
    expect(sumCents([3590, 6590, 7590])).toBe(17770);
    expect(sumCents([])).toBe(0);
  });
});
