import type { Movement, UUID } from '../domain/models';
import { purchaseSupply } from '../domain/inventory';
import type { EstoqueRepository } from '../infra/storage/EstoqueRepository';

export type RegisterSupplyPurchaseInput = {
  supplyId: UUID;
  quantity: number;
  note?: string;
};

export type RegisterSupplyPurchaseResult =
  { ok: true; movement: Movement } | { ok: false; reason: 'supply_not_found' };

export type RegisterSupplyPurchaseDeps = { now?: () => Date; generateId?: () => string };

/** Entrada de matéria-prima (compra de insumo). */
export function registerSupplyPurchase(
  repository: EstoqueRepository,
  input: RegisterSupplyPurchaseInput,
  deps: RegisterSupplyPurchaseDeps = {},
): RegisterSupplyPurchaseResult {
  const now = deps.now ?? (() => new Date());
  const generateId = deps.generateId ?? (() => crypto.randomUUID());

  const supply = repository.listSupplies().find((s) => s.id === input.supplyId);
  if (!supply) {
    return { ok: false, reason: 'supply_not_found' };
  }

  const updated = purchaseSupply(supply, input.quantity);

  const movement: Movement = {
    id: generateId(),
    type: 'supply_purchase',
    occurredAt: now().toISOString(),
    supplyId: supply.id,
    quantity: input.quantity,
    note: input.note,
    undone: false,
  };

  repository.saveSupply(updated);
  repository.appendMovement(movement);

  return { ok: true, movement };
}
