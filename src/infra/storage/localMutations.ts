import type { Movement } from '../../domain/models';
import {
  adjustProductQuantity,
  adjustSupplyQuantity,
  assertPurchaseCost,
  purchaseSupply,
  reverseProduction,
  reverseProductAdjustment,
  reverseSale,
  reverseSupplyAdjustment,
  reverseSupplyPurchase,
  sell,
} from '../../domain/inventory';
import { produce } from '../../domain/production';
import { multiplyCents } from '../../domain/money';
import type {
  AdjustStockInput,
  AdjustStockResult,
  OperationDeps,
  RegisterProductionInput,
  RegisterProductionResult,
  RegisterSaleInput,
  RegisterSaleResult,
  RegisterSupplyPurchaseInput,
  RegisterSupplyPurchaseResult,
  UndoMovementResult,
} from '../../domain/operations';
import type { EstoqueState } from './EstoqueRepository';

/**
 * Aplicação em memória das mutações de estoque, compartilhada por
 * `LocalStorageRepository` e `InMemoryRepository`. Ambas rodam num único
 * processo (sem escrita concorrente de verdade), então "ler tudo, calcular
 * com `domain/`, devolver o novo estado" é seguro — diferente do adapter
 * Supabase, que precisa de transação no banco para a mesma garantia.
 */

function nowAndId(deps: OperationDeps) {
  return {
    now: deps.now ?? (() => new Date()),
    generateId: deps.generateId ?? (() => crypto.randomUUID()),
  };
}

export function applyRegisterSale(
  state: EstoqueState,
  input: RegisterSaleInput,
  deps: OperationDeps = {},
): { state: EstoqueState; result: RegisterSaleResult } {
  const { now, generateId } = nowAndId(deps);
  const product = state.products.find((p) => p.id === input.productId);
  if (!product) return { state, result: { ok: false, reason: 'product_not_found' } };

  const sellResult = sell(product, input.quantity);
  if (!sellResult.ok) return { state, result: sellResult };

  const movement: Movement = {
    id: generateId(),
    type: 'sale',
    occurredAt: now().toISOString(),
    productId: product.id,
    quantity: input.quantity,
    totalCents: input.totalCents ?? multiplyCents(product.priceCents, input.quantity),
    note: input.note,
    undone: false,
  };

  const products = state.products.map((p) => (p.id === product.id ? sellResult.value : p));
  return {
    state: { ...state, products, movements: [...state.movements, movement] },
    result: { ok: true, movement },
  };
}

export function applyRegisterProduction(
  state: EstoqueState,
  input: RegisterProductionInput,
  deps: OperationDeps = {},
): { state: EstoqueState; result: RegisterProductionResult } {
  const { now, generateId } = nowAndId(deps);
  const product = state.products.find((p) => p.id === input.productId);
  if (!product) return { state, result: { ok: false, reason: 'product_not_found' } };

  const recipe = product.recipeId
    ? state.recipes.find((r) => r.id === product.recipeId)
    : undefined;

  const produceResult = produce(product, input.quantity, recipe, state.supplies);
  if (!produceResult.ok) return { state, result: produceResult };

  const movement: Movement = {
    id: generateId(),
    type: 'production',
    occurredAt: now().toISOString(),
    productId: product.id,
    quantity: input.quantity,
    consumed: produceResult.value.consumed,
    note: input.note,
    undone: false,
  };

  const products = state.products.map((p) =>
    p.id === product.id ? produceResult.value.product : p,
  );
  const supplyById = new Map(produceResult.value.supplies.map((s) => [s.id, s]));
  const supplies = state.supplies.map((s) => supplyById.get(s.id) ?? s);

  return {
    state: { ...state, products, supplies, movements: [...state.movements, movement] },
    result: { ok: true, movement },
  };
}

export function applyRegisterSupplyPurchase(
  state: EstoqueState,
  input: RegisterSupplyPurchaseInput,
  deps: OperationDeps = {},
): { state: EstoqueState; result: RegisterSupplyPurchaseResult } {
  const { now, generateId } = nowAndId(deps);
  const supply = state.supplies.find((s) => s.id === input.supplyId);
  if (!supply) return { state, result: { ok: false, reason: 'supply_not_found' } };

  assertPurchaseCost(input.totalCents);
  const updated = purchaseSupply(supply, input.quantity);

  const movement: Movement = {
    id: generateId(),
    type: 'supply_purchase',
    occurredAt: now().toISOString(),
    supplyId: supply.id,
    quantity: input.quantity,
    totalCents: input.totalCents,
    note: input.note,
    undone: false,
  };

  const supplies = state.supplies.map((s) => (s.id === supply.id ? updated : s));
  return {
    state: { ...state, supplies, movements: [...state.movements, movement] },
    result: { ok: true, movement },
  };
}

export function applyAdjustStock(
  state: EstoqueState,
  input: AdjustStockInput,
  deps: OperationDeps = {},
): { state: EstoqueState; result: AdjustStockResult } {
  if (!input.note.trim()) return { state, result: { ok: false, reason: 'note_required' } };

  const { now, generateId } = nowAndId(deps);

  if (input.target === 'product') {
    const product = state.products.find((p) => p.id === input.id);
    if (!product) return { state, result: { ok: false, reason: 'not_found' } };

    const adjustResult = adjustProductQuantity(product, input.delta);
    if (!adjustResult.ok) return { state, result: adjustResult };

    const movement: Movement = {
      id: generateId(),
      type: 'adjustment',
      occurredAt: now().toISOString(),
      productId: product.id,
      quantity: input.delta,
      note: input.note,
      undone: false,
    };

    const products = state.products.map((p) => (p.id === product.id ? adjustResult.value : p));
    return {
      state: { ...state, products, movements: [...state.movements, movement] },
      result: { ok: true, movement },
    };
  }

  const supply = state.supplies.find((s) => s.id === input.id);
  if (!supply) return { state, result: { ok: false, reason: 'not_found' } };

  const adjustResult = adjustSupplyQuantity(supply, input.delta);
  if (!adjustResult.ok) return { state, result: adjustResult };

  const movement: Movement = {
    id: generateId(),
    type: 'adjustment',
    occurredAt: now().toISOString(),
    supplyId: supply.id,
    quantity: input.delta,
    note: input.note,
    undone: false,
  };

  const supplies = state.supplies.map((s) => (s.id === supply.id ? adjustResult.value : s));
  return {
    state: { ...state, supplies, movements: [...state.movements, movement] },
    result: { ok: true, movement },
  };
}

export function applyUndoMovement(
  state: EstoqueState,
  movementId: string,
): { state: EstoqueState; result: UndoMovementResult } {
  const movement = state.movements.find((m) => m.id === movementId);
  if (!movement) return { state, result: { ok: false, reason: 'not_found' } };
  if (movement.undone) return { state, result: { ok: false, reason: 'already_undone' } };

  let products = state.products;
  let supplies = state.supplies;

  switch (movement.type) {
    case 'sale': {
      const product = movement.productId
        ? products.find((p) => p.id === movement.productId)
        : undefined;
      if (!product) return { state, result: { ok: false, reason: 'not_found' } };
      const reversed = reverseSale(product, movement);
      products = products.map((p) => (p.id === product.id ? reversed : p));
      break;
    }

    case 'production': {
      const product = movement.productId
        ? products.find((p) => p.id === movement.productId)
        : undefined;
      if (!product) return { state, result: { ok: false, reason: 'not_found' } };

      const reverseResult = reverseProduction(product, supplies, movement);
      if (!reverseResult.ok) return { state, result: reverseResult };

      products = products.map((p) => (p.id === product.id ? reverseResult.value.product : p));
      const supplyById = new Map(reverseResult.value.supplies.map((s) => [s.id, s]));
      supplies = supplies.map((s) => supplyById.get(s.id) ?? s);
      break;
    }

    case 'supply_purchase': {
      const supply = movement.supplyId
        ? supplies.find((s) => s.id === movement.supplyId)
        : undefined;
      if (!supply) return { state, result: { ok: false, reason: 'not_found' } };

      const reverseResult = reverseSupplyPurchase(supply, movement);
      if (!reverseResult.ok) return { state, result: reverseResult };
      supplies = supplies.map((s) => (s.id === supply.id ? reverseResult.value : s));
      break;
    }

    case 'adjustment': {
      if (movement.productId) {
        const product = products.find((p) => p.id === movement.productId);
        if (!product) return { state, result: { ok: false, reason: 'not_found' } };

        const reverseResult = reverseProductAdjustment(product, movement);
        if (!reverseResult.ok) return { state, result: reverseResult };
        products = products.map((p) => (p.id === product.id ? reverseResult.value : p));
      } else if (movement.supplyId) {
        const supply = supplies.find((s) => s.id === movement.supplyId);
        if (!supply) return { state, result: { ok: false, reason: 'not_found' } };

        const reverseResult = reverseSupplyAdjustment(supply, movement);
        if (!reverseResult.ok) return { state, result: reverseResult };
        supplies = supplies.map((s) => (s.id === supply.id ? reverseResult.value : s));
      } else {
        return { state, result: { ok: false, reason: 'not_found' } };
      }
      break;
    }
  }

  const movements = state.movements.map((m) => (m.id === movementId ? { ...m, undone: true } : m));
  return {
    state: { ...state, products, supplies, movements },
    result: { ok: true },
  };
}
