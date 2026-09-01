import type { Movement, UUID } from '../domain/models';
import { adjustProductQuantity, adjustSupplyQuantity } from '../domain/inventory';
import type { EstoqueRepository } from '../infra/storage/EstoqueRepository';

export type AdjustStockInput =
  | { target: 'product'; id: UUID; delta: number; note: string }
  | { target: 'supply'; id: UUID; delta: number; note: string };

export type AdjustStockResult =
  | { ok: true; movement: Movement }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'note_required' }
  | { ok: false; reason: 'negative_result'; resulting: number };

export type AdjustStockDeps = { now?: () => Date; generateId?: () => string };

/** Correção manual (quebra, perda, recontagem). Sempre exige justificativa. */
export function adjustStock(
  repository: EstoqueRepository,
  input: AdjustStockInput,
  deps: AdjustStockDeps = {},
): AdjustStockResult {
  if (!input.note.trim()) {
    return { ok: false, reason: 'note_required' };
  }

  const now = deps.now ?? (() => new Date());
  const generateId = deps.generateId ?? (() => crypto.randomUUID());

  if (input.target === 'product') {
    const product = repository.listProducts().find((p) => p.id === input.id);
    if (!product) return { ok: false, reason: 'not_found' };

    const result = adjustProductQuantity(product, input.delta);
    if (!result.ok) return result;

    const movement: Movement = {
      id: generateId(),
      type: 'adjustment',
      occurredAt: now().toISOString(),
      productId: product.id,
      quantity: input.delta,
      note: input.note,
      undone: false,
    };

    repository.saveProduct(result.value);
    repository.appendMovement(movement);
    return { ok: true, movement };
  }

  const supply = repository.listSupplies().find((s) => s.id === input.id);
  if (!supply) return { ok: false, reason: 'not_found' };

  const result = adjustSupplyQuantity(supply, input.delta);
  if (!result.ok) return result;

  const movement: Movement = {
    id: generateId(),
    type: 'adjustment',
    occurredAt: now().toISOString(),
    supplyId: supply.id,
    quantity: input.delta,
    note: input.note,
    undone: false,
  };

  repository.saveSupply(result.value);
  repository.appendMovement(movement);
  return { ok: true, movement };
}
