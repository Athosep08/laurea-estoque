import type { UUID } from '../domain/models';
import {
  reverseProduction,
  reverseProductAdjustment,
  reverseSale,
  reverseSupplyAdjustment,
  reverseSupplyPurchase,
} from '../domain/inventory';
import type { EstoqueRepository } from '../infra/storage/EstoqueRepository';

export type UndoMovementResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'already_undone' }
  | { ok: false; reason: 'negative_result'; resulting: number };

/**
 * Marca o movimento como desfeito e reverte seus efeitos no estoque.
 * Produção devolve exatamente os insumos gravados em `movement.consumed`,
 * não os que a ficha técnica atual diria — por isso o desfazer continua
 * correto mesmo que a receita tenha mudado depois.
 */
export function undoMovement(repository: EstoqueRepository, movementId: UUID): UndoMovementResult {
  const movement = repository.listMovements().find((m) => m.id === movementId);
  if (!movement) return { ok: false, reason: 'not_found' };
  if (movement.undone) return { ok: false, reason: 'already_undone' };

  switch (movement.type) {
    case 'sale': {
      const product = movement.productId
        ? repository.listProducts().find((p) => p.id === movement.productId)
        : undefined;
      if (!product) return { ok: false, reason: 'not_found' };
      repository.saveProduct(reverseSale(product, movement));
      break;
    }

    case 'production': {
      const product = movement.productId
        ? repository.listProducts().find((p) => p.id === movement.productId)
        : undefined;
      if (!product) return { ok: false, reason: 'not_found' };

      const result = reverseProduction(product, repository.listSupplies(), movement);
      if (!result.ok) return result;

      repository.saveProduct(result.value.product);
      for (const supply of result.value.supplies) {
        repository.saveSupply(supply);
      }
      break;
    }

    case 'supply_purchase': {
      const supply = movement.supplyId
        ? repository.listSupplies().find((s) => s.id === movement.supplyId)
        : undefined;
      if (!supply) return { ok: false, reason: 'not_found' };

      const result = reverseSupplyPurchase(supply, movement);
      if (!result.ok) return result;
      repository.saveSupply(result.value);
      break;
    }

    case 'adjustment': {
      if (movement.productId) {
        const product = repository.listProducts().find((p) => p.id === movement.productId);
        if (!product) return { ok: false, reason: 'not_found' };

        const result = reverseProductAdjustment(product, movement);
        if (!result.ok) return result;
        repository.saveProduct(result.value);
      } else if (movement.supplyId) {
        const supply = repository.listSupplies().find((s) => s.id === movement.supplyId);
        if (!supply) return { ok: false, reason: 'not_found' };

        const result = reverseSupplyAdjustment(supply, movement);
        if (!result.ok) return result;
        repository.saveSupply(result.value);
      } else {
        return { ok: false, reason: 'not_found' };
      }
      break;
    }
  }

  repository.updateMovement({ ...movement, undone: true });
  return { ok: true };
}
