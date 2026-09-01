import type { ConsumedSupply, Product, Recipe, Supply, UUID } from './models';
import { receiveProduction } from './inventory';
import { roundQuantity } from './quantity';

export type MissingSupply = { supplyId: UUID; required: number; available: number };

export type ProduceResult =
  | { ok: true; value: { product: Product; supplies: Supply[]; consumed: ConsumedSupply[] } }
  | { ok: false; reason: 'missing_supplies'; missing: MissingSupply[] };

/**
 * Produz `quantity` unidades de `product`. Se o produto tem ficha técnica,
 * calcula o consumo de cada insumo e só aplica o efeito se TODOS os insumos
 * necessários estiverem disponíveis — falha antes de tocar em qualquer coisa.
 */
export function produce(
  product: Product,
  quantity: number,
  recipe: Recipe | undefined,
  supplies: Supply[],
): ProduceResult {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('A quantidade produzida deve ser um número inteiro maior que zero.');
  }

  if (!recipe) {
    return {
      ok: true,
      value: { product: receiveProduction(product, quantity), supplies, consumed: [] },
    };
  }

  const supplyById = new Map(supplies.map((supply) => [supply.id, supply]));
  const consumed: ConsumedSupply[] = [];
  const missing: MissingSupply[] = [];

  for (const item of recipe.items) {
    const required = roundQuantity(item.quantityPerUnit * quantity);
    const available = supplyById.get(item.supplyId)?.quantity ?? 0;
    if (available < required) {
      missing.push({ supplyId: item.supplyId, required, available });
    }
    consumed.push({ supplyId: item.supplyId, quantity: required });
  }

  if (missing.length > 0) {
    return { ok: false, reason: 'missing_supplies', missing };
  }

  const updatedSupplies = supplies.map((supply) => {
    const entry = consumed.find((item) => item.supplyId === supply.id);
    return entry
      ? { ...supply, quantity: roundQuantity(supply.quantity - entry.quantity) }
      : supply;
  });

  return {
    ok: true,
    value: {
      product: receiveProduction(product, quantity),
      supplies: updatedSupplies,
      consumed,
    },
  };
}
