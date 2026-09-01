import type { AdjustStockInput, AdjustStockResult, OperationDeps } from '../domain/operations';
import type { EstoqueRepository } from '../infra/storage/EstoqueRepository';

export type { AdjustStockInput, AdjustStockResult };
export type AdjustStockDeps = OperationDeps;

/** Correção manual (quebra, perda, recontagem). Sempre exige justificativa. */
export function adjustStock(
  repository: EstoqueRepository,
  input: AdjustStockInput,
  deps: OperationDeps = {},
): Promise<AdjustStockResult> {
  return repository.adjustStock(input, deps);
}
