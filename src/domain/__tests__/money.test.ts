import { describe, expect, it } from 'vitest';
import {
  centsToReais,
  formatBRL,
  multiplyCents,
  parseReaisInput,
  reaisToCents,
  sumCents,
} from '../money';

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

describe('parseReaisInput', () => {
  it('aceita vírgula ou ponto decimal e separador de milhar', () => {
    expect(parseReaisInput('180')).toBe(18000);
    expect(parseReaisInput('180,50')).toBe(18050);
    expect(parseReaisInput('180.50')).toBe(18050);
    expect(parseReaisInput('1.234,56')).toBe(123456);
    expect(parseReaisInput('R$ 65,90')).toBe(6590);
  });

  it('campo vazio é valor não informado', () => {
    expect(parseReaisInput('')).toBeUndefined();
    expect(parseReaisInput('   ')).toBeUndefined();
  });

  it('texto que não é valor vira NaN', () => {
    expect(parseReaisInput('abc')).toBeNaN();
    expect(parseReaisInput('-5')).toBeNaN();
    expect(parseReaisInput('12,3,4')).toBeNaN();
  });
});
