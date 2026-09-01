import type {
  OperationDeps,
  RegisterProductionInput,
  RegisterProductionResult,
} from '../domain/operations';
import type { EstoqueRepository } from '../infra/storage/EstoqueRepository';

export type { RegisterProductionInput, RegisterProductionResult };
export type RegisterProductionDeps = OperationDeps;

export function registerProduction(
  repository: EstoqueRepository,
  input: RegisterProductionInput,
  deps: OperationDeps = {},
): Promise<RegisterProductionResult> {
  return repository.registerProduction(input, deps);
}
