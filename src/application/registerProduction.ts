import type { Movement, UUID } from '../domain/models';
import { produce, type MissingSupply } from '../domain/production';
import type { EstoqueRepository } from '../infra/storage/EstoqueRepository';

export type RegisterProductionInput = {
  productId: UUID;
  quantity: number;
  note?: string;
};

export type RegisterProductionResult =
  | { ok: true; movement: Movement }
  | { ok: false; reason: 'product_not_found' }
  | { ok: false; reason: 'missing_supplies'; missing: MissingSupply[] };

export type RegisterProductionDeps = { now?: () => Date; generateId?: () => string };

export function registerProduction(
  repository: EstoqueRepository,
  input: RegisterProductionInput,
  deps: RegisterProductionDeps = {},
): RegisterProductionResult {
  const now = deps.now ?? (() => new Date());
  const generateId = deps.generateId ?? (() => crypto.randomUUID());

  const product = repository.listProducts().find((p) => p.id === input.productId);
  if (!product) {
    return { ok: false, reason: 'product_not_found' };
  }

  const recipe = product.recipeId
    ? repository.listRecipes().find((r) => r.id === product.recipeId)
    : undefined;

  const result = produce(product, input.quantity, recipe, repository.listSupplies());
  if (!result.ok) {
    return result;
  }

  const movement: Movement = {
    id: generateId(),
    type: 'production',
    occurredAt: now().toISOString(),
    productId: product.id,
    quantity: input.quantity,
    consumed: result.value.consumed,
    note: input.note,
    undone: false,
  };

  repository.saveProduct(result.value.product);
  for (const supply of result.value.supplies) {
    repository.saveSupply(supply);
  }
  repository.appendMovement(movement);

  return { ok: true, movement };
}
