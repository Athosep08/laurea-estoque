import type { UUID } from '../domain/models';
import type { UndoMovementResult } from '../domain/operations';
import type { EstoqueRepository } from '../infra/storage/EstoqueRepository';

export type { UndoMovementResult };

/**
 * Marca o movimento como desfeito e reverte seus efeitos no estoque.
 * Produção devolve exatamente os insumos gravados em `movement.consumed`,
 * não os que a ficha técnica atual diria — por isso o desfazer continua
 * correto mesmo que a receita tenha mudado depois.
 */
export function undoMovement(
  repository: EstoqueRepository,
  movementId: UUID,
): Promise<UndoMovementResult> {
  return repository.undoMovement(movementId);
}
