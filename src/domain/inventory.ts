import type { Movement, Product, Supply } from './models';
import { roundQuantity } from './quantity';

/**
 * Resultado de uma operação que pode violar o invariante "estoque não fica negativo".
 * `resulting` é sempre informado para permitir mensagens de erro precisas na UI.
 */
export type QuantityResult<T> =
  { ok: true; value: T } | { ok: false; reason: 'negative_result'; resulting: number };

export type SellResult =
  | { ok: true; value: Product }
  | { ok: false; reason: 'insufficient_stock'; available: number; requested: number };

function assertPositiveInteger(quantity: number, label: string): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(`${label} deve ser um número inteiro maior que zero.`);
  }
}

function assertPositive(quantity: number, label: string): void {
  if (!(quantity > 0)) {
    throw new Error(`${label} deve ser maior que zero.`);
  }
}

function guardNonNegative<T>(
  rawResulting: number,
  build: (quantity: number) => T,
): QuantityResult<T> {
  const resulting = roundQuantity(rawResulting);
  if (resulting < 0) {
    return { ok: false, reason: 'negative_result', resulting };
  }
  return { ok: true, value: build(resulting) };
}

export function isLowStock(item: { quantity: number; minQuantity: number }): boolean {
  return item.quantity <= item.minQuantity;
}

export function canFulfillSale(product: Product, quantity: number): boolean {
  return quantity <= product.quantity;
}

/** Registra uma venda. Estoque nunca fica negativo — falha explica o que faltou. */
export function sell(product: Product, quantity: number): SellResult {
  assertPositiveInteger(quantity, 'A quantidade vendida');
  if (!canFulfillSale(product, quantity)) {
    return {
      ok: false,
      reason: 'insufficient_stock',
      available: product.quantity,
      requested: quantity,
    };
  }
  return { ok: true, value: { ...product, quantity: product.quantity - quantity } };
}

/** Soma unidades produzidas ao estoque do produto. Não mexe em insumos. */
export function receiveProduction(product: Product, quantity: number): Product {
  assertPositiveInteger(quantity, 'A quantidade produzida');
  return { ...product, quantity: product.quantity + quantity };
}

/** Registra a compra/entrada de um insumo. */
/** Valor pago numa entrada: centavos inteiros, zero é permitido (brinde). */
export function assertPurchaseCost(totalCents: number | undefined): void {
  if (totalCents === undefined) return;
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new Error('O valor pago deve ser zero ou maior, em centavos inteiros.');
  }
}

export function purchaseSupply(supply: Supply, quantity: number): Supply {
  assertPositive(quantity, 'A quantidade comprada');
  return { ...supply, quantity: roundQuantity(supply.quantity + quantity) };
}

/** Ajuste manual (quebra, perda, recontagem). Delta pode ser positivo ou negativo. */
export function adjustProductQuantity(product: Product, delta: number): QuantityResult<Product> {
  return guardNonNegative(product.quantity + delta, (quantity) => ({ ...product, quantity }));
}

export function adjustSupplyQuantity(supply: Supply, delta: number): QuantityResult<Supply> {
  return guardNonNegative(supply.quantity + delta, (quantity) => ({ ...supply, quantity }));
}

// --- Reversão de movimentos ------------------------------------------------
// Cada função abaixo desfaz exatamente o efeito aplicado no momento do
// movimento original. Produção usa `movement.consumed`, não a ficha técnica
// atual — se a receita mudou depois, o desfazer ainda devolve o valor certo.

export function reverseSale(product: Product, movement: Movement): Product {
  return { ...product, quantity: product.quantity + movement.quantity };
}

export function reverseSupplyPurchase(supply: Supply, movement: Movement): QuantityResult<Supply> {
  return guardNonNegative(supply.quantity - movement.quantity, (quantity) => ({
    ...supply,
    quantity,
  }));
}

export function reverseProductAdjustment(
  product: Product,
  movement: Movement,
): QuantityResult<Product> {
  return guardNonNegative(product.quantity - movement.quantity, (quantity) => ({
    ...product,
    quantity,
  }));
}

export function reverseSupplyAdjustment(
  supply: Supply,
  movement: Movement,
): QuantityResult<Supply> {
  return guardNonNegative(supply.quantity - movement.quantity, (quantity) => ({
    ...supply,
    quantity,
  }));
}

export function reverseProduction(
  product: Product,
  supplies: Supply[],
  movement: Movement,
): QuantityResult<{ product: Product; supplies: Supply[] }> {
  const consumed = movement.consumed ?? [];
  const productResult = guardNonNegative(product.quantity - movement.quantity, (quantity) => ({
    ...product,
    quantity,
  }));
  if (!productResult.ok) {
    return productResult;
  }
  const supplies_ = supplies.map((supply) => {
    const entry = consumed.find((item) => item.supplyId === supply.id);
    if (!entry) return supply;
    return { ...supply, quantity: roundQuantity(supply.quantity + entry.quantity) };
  });
  return { ok: true, value: { product: productResult.value, supplies: supplies_ } };
}
