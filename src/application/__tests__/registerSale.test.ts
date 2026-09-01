import { describe, expect, it } from 'vitest';
import { registerSale } from '../registerSale';
import { InMemoryRepository } from '../../infra/storage/InMemoryRepository';
import { makeProduct } from '../../domain/__tests__/factories';

const deps = { now: () => new Date('2026-09-01T12:00:00.000Z'), generateId: () => 'movement-1' };

describe('registerSale (caso de uso)', () => {
  it('debita o estoque, grava o movimento e sugere o total pelo preço do produto', async () => {
    const product = makeProduct({ id: 'p1', quantity: 5, priceCents: 3590 });
    const repo = new InMemoryRepository({ products: [product] });

    const result = await registerSale(repo, { productId: 'p1', quantity: 2 }, deps);

    expect(result).toEqual({
      ok: true,
      movement: {
        id: 'movement-1',
        type: 'sale',
        occurredAt: '2026-09-01T12:00:00.000Z',
        productId: 'p1',
        quantity: 2,
        totalCents: 7180,
        note: undefined,
        undone: false,
      },
    });
    expect((await repo.listProducts())[0].quantity).toBe(3);
    expect(await repo.listMovements()).toHaveLength(1);
  });

  it('permite editar o total sugerido (desconto, combo, pedido exclusivo)', async () => {
    const product = makeProduct({ id: 'p1', quantity: 5, priceCents: 3590 });
    const repo = new InMemoryRepository({ products: [product] });

    const result = await registerSale(
      repo,
      { productId: 'p1', quantity: 2, totalCents: 6000 },
      deps,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.movement.totalCents).toBe(6000);
    }
  });

  it('falha sem alterar o estoque quando o produto não existe', async () => {
    const repo = new InMemoryRepository();
    const result = await registerSale(repo, { productId: 'missing', quantity: 1 }, deps);
    expect(result).toEqual({ ok: false, reason: 'product_not_found' });
    expect(await repo.listMovements()).toHaveLength(0);
  });

  it('falha sem alterar nada quando pede mais do que há em estoque', async () => {
    const product = makeProduct({ id: 'p1', quantity: 1 });
    const repo = new InMemoryRepository({ products: [product] });

    const result = await registerSale(repo, { productId: 'p1', quantity: 5 }, deps);

    expect(result).toEqual({
      ok: false,
      reason: 'insufficient_stock',
      available: 1,
      requested: 5,
    });
    expect((await repo.listProducts())[0].quantity).toBe(1);
    expect(await repo.listMovements()).toHaveLength(0);
  });
});
