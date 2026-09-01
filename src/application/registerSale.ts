import type { Cents, Movement, UUID } from '../domain/models';
import { sell } from '../domain/inventory';
import { multiplyCents } from '../domain/money';
import type { EstoqueRepository } from '../infra/storage/EstoqueRepository';

export type RegisterSaleInput = {
  productId: UUID;
  quantity: number;
  /** Se omitido, é sugerido como priceCents × quantidade, mas é editável (desconto, combo). */
  totalCents?: Cents;
  note?: string;
};

export type RegisterSaleResult =
  | { ok: true; movement: Movement }
  | { ok: false; reason: 'product_not_found' }
  | { ok: false; reason: 'insufficient_stock'; available: number; requested: number };

export type RegisterSaleDeps = { now?: () => Date; generateId?: () => string };

export function registerSale(
  repository: EstoqueRepository,
  input: RegisterSaleInput,
  deps: RegisterSaleDeps = {},
): RegisterSaleResult {
  const now = deps.now ?? (() => new Date());
  const generateId = deps.generateId ?? (() => crypto.randomUUID());

  const product = repository.listProducts().find((p) => p.id === input.productId);
  if (!product) {
    return { ok: false, reason: 'product_not_found' };
  }

  const result = sell(product, input.quantity);
  if (!result.ok) {
    return result;
  }

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

  repository.saveProduct(result.value);
  repository.appendMovement(movement);

  return { ok: true, movement };
}
