import type { Cents } from './models';

/** Converte reais (podendo ter centavos fracionários por erro de input) para centavos inteiros. */
export function reaisToCents(reais: number): Cents {
  return Math.round(reais * 100);
}

export function centsToReais(cents: Cents): number {
  return cents / 100;
}

/** Formata centavos como moeda brasileira, ex.: 3590 -> 'R$ 35,90'. */
export function formatBRL(cents: Cents): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(centsToReais(cents));
}

export function multiplyCents(cents: Cents, quantity: number): Cents {
  return Math.round(cents * quantity);
}

export function sumCents(values: Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Lê um valor digitado em reais: "180", "180,50", "1.234,56" ou "180.50".
 * Campo vazio devolve `undefined` (valor não informado); texto que não é
 * número devolve `NaN`, para quem chama mostrar o erro.
 */
export function parseReaisInput(text: string): Cents | undefined {
  const raw = text.trim().replace(/^R\$\s*/i, '');
  if (!raw) return undefined;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return Number.NaN;
  return reaisToCents(Number(normalized));
}
