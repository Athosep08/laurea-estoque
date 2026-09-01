import { describe, expect, it } from 'vitest';
import { registerSale } from '../registerSale';
import { InMemoryRepository } from '../../infra/storage/InMemoryRepository';
import { makeProduct } from '../../domain/__tests__/factories';

const deps = { now: () => new Date('2026-09-01T12:00:00.000Z'), generateId: () => 'movement-1' };

describe('registerSale (caso de uso)', () => {
  it('debita o estoque, grava o movimento e sugere o total pelo preço do produto', () => {
    const product = makeProduct({ id: 'p1', quantity: 5, priceCents: 3590 });
    const repo = new InMemoryRepository({ products: [product] });

    const result = registerSale(repo, { productId: 'p1', quantity: 2 }, deps);

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
    expect(repo.listProducts()[0].quantity).toBe(3);
    expect(repo.listMovements()).toHaveLength(1);
  });

  it('permite editar o total sugerido (desconto, combo, pedido exclusivo)', () => {
    const product = makeProduct({ id: 'p1', quantity: 5, priceCents: 3590 });
    const repo = new InMemoryRepository({ products: [product] });

    const result = registerSale(repo, { productId: 'p1', quantity: 2, totalCents: 6000 }, deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.movement.totalCents).toBe(6000);
    }
  });

  it('falha sem alterar o estoque quando o produto não existe', () => {
    const repo = new InMemoryRepository();
    const result = registerSale(repo, { productId: 'missing', quantity: 1 }, deps);
    expect(result).toEqual({ ok: false, reason: 'product_not_found' });
    expect(repo.listMovements()).toHaveLength(0);
  });

  it('falha sem alterar nada quando pede mais do que há em estoque', () => {
    const product = makeProduct({ id: 'p1', quantity: 1 });
    const repo = new InMemoryRepository({ products: [product] });

    const result = registerSale(repo, { productId: 'p1', quantity: 5 }, deps);

    expect(result).toEqual({
      ok: false,
      reason: 'insufficient_stock',
      available: 1,
      requested: 5,
    });
    expect(repo.listProducts()[0].quantity).toBe(1);
    expect(repo.listMovements()).toHaveLength(0);
  });
});
