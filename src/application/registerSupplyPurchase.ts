import type {
  OperationDeps,
  RegisterSupplyPurchaseInput,
  RegisterSupplyPurchaseResult,
} from '../domain/operations';
import type { EstoqueRepository } from '../infra/storage/EstoqueRepository';

export type { RegisterSupplyPurchaseInput, RegisterSupplyPurchaseResult };
export type RegisterSupplyPurchaseDeps = OperationDeps;

/** Entrada de matéria-prima (compra de insumo). */
export function registerSupplyPurchase(
  repository: EstoqueRepository,
  input: RegisterSupplyPurchaseInput,
  deps: OperationDeps = {},
): Promise<RegisterSupplyPurchaseResult> {
  return repository.registerSupplyPurchase(input, deps);
}
