import type { OperationDeps, RegisterSaleInput, RegisterSaleResult } from '../domain/operations';
import type { EstoqueRepository } from '../infra/storage/EstoqueRepository';

export type { RegisterSaleInput, RegisterSaleResult };
export type RegisterSaleDeps = OperationDeps;

/**
 * Ponto de entrada nomeado para a UI. A garantia de atomicidade (não deixar
 * o estoque negativo com dois aparelhos vendendo ao mesmo tempo) vive na
 * implementação do repositório — local roda a regra de `domain/inventory.ts`
 * em processo, Supabase delega a uma função no Postgres.
 */
export function registerSale(
  repository: EstoqueRepository,
  input: RegisterSaleInput,
  deps: OperationDeps = {},
): Promise<RegisterSaleResult> {
  return repository.registerSale(input, deps);
}
