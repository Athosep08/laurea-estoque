import type { Cents, Movement, UUID } from './models';
import type { MissingSupply } from './production';

/**
 * Contratos de entrada/saída das mutações de estoque (venda, produção, compra
 * de insumo, ajuste, desfazer). Vivem em `domain/` — não em `application/` ou
 * `infra/` — porque tanto o adapter local (que roda essa lógica em memória via
 * as funções de `inventory.ts`/`production.ts`) quanto o adapter Supabase (que
 * delega a mesma lógica para uma função no Postgres) precisam do mesmo
 * contrato, e nenhum dos dois deve depender do outro.
 */

export type OperationDeps = { now?: () => Date; generateId?: () => string };

export type RegisterSaleInput = {
  productId: UUID;
  quantity: number;
  totalCents?: Cents;
  note?: string;
};

export type RegisterSaleResult =
  | { ok: true; movement: Movement }
  | { ok: false; reason: 'product_not_found' }
  | { ok: false; reason: 'insufficient_stock'; available: number; requested: number };

export type RegisterProductionInput = {
  productId: UUID;
  quantity: number;
  note?: string;
};

export type RegisterProductionResult =
  | { ok: true; movement: Movement }
  | { ok: false; reason: 'product_not_found' }
  | { ok: false; reason: 'missing_supplies'; missing: MissingSupply[] };

export type RegisterSupplyPurchaseInput = {
  supplyId: UUID;
  quantity: number;
  /** Quanto foi pago por essa entrada. Opcional: brinde ou valor desconhecido. */
  totalCents?: Cents;
  note?: string;
};

export type RegisterSupplyPurchaseResult =
  { ok: true; movement: Movement } | { ok: false; reason: 'supply_not_found' };

export type AdjustStockInput =
  | { target: 'product'; id: UUID; delta: number; note: string }
  | { target: 'supply'; id: UUID; delta: number; note: string };

export type AdjustStockResult =
  | { ok: true; movement: Movement }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'note_required' }
  | { ok: false; reason: 'negative_result'; resulting: number };

export type UndoMovementResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'already_undone' }
  | { ok: false; reason: 'negative_result'; resulting: number };
