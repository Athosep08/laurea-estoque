import { describe, expect, it } from 'vitest';
import { registerProduction } from '../registerProduction';
import { InMemoryRepository } from '../../infra/storage/InMemoryRepository';
import { makeProduct, makeRecipe, makeSupply } from '../../domain/__tests__/factories';

const deps = { now: () => new Date('2026-09-01T12:00:00.000Z'), generateId: () => 'movement-1' };

describe('registerProduction (caso de uso)', () => {
  it('produz, baixa insumos pela ficha técnica e grava o consumo no movimento', async () => {
    const wax = makeSupply({ id: 'wax', quantity: 5 });
    const recipe = makeRecipe({ id: 'r1', items: [{ supplyId: 'wax', quantityPerUnit: 0.18 }] });
    const product = makeProduct({ id: 'p1', quantity: 0, recipeId: 'r1' });
    const repo = new InMemoryRepository({
      products: [product],
      recipes: [recipe],
      supplies: [wax],
    });

    const result = await registerProduction(repo, { productId: 'p1', quantity: 10 }, deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.movement.consumed).toEqual([{ supplyId: 'wax', quantity: 1.8 }]);
    }
    expect((await repo.listProducts())[0].quantity).toBe(10);
    expect((await repo.listSupplies())[0].quantity).toBeCloseTo(3.2);
  });

  it('falha sem aplicar efeito quando falta insumo, e não grava movimento', async () => {
    const wax = makeSupply({ id: 'wax', quantity: 1 });
    const recipe = makeRecipe({ id: 'r1', items: [{ supplyId: 'wax', quantityPerUnit: 0.18 }] });
    const product = makeProduct({ id: 'p1', quantity: 0, recipeId: 'r1' });
    const repo = new InMemoryRepository({
      products: [product],
      recipes: [recipe],
      supplies: [wax],
    });

    const result = await registerProduction(repo, { productId: 'p1', quantity: 10 }, deps);

    expect(result).toEqual({
      ok: false,
      reason: 'missing_supplies',
      missing: [{ supplyId: 'wax', required: 1.8, available: 1 }],
    });
    expect((await repo.listProducts())[0].quantity).toBe(0);
    expect((await repo.listSupplies())[0].quantity).toBe(1);
    expect(await repo.listMovements()).toHaveLength(0);
  });

  it('produto sem ficha técnica soma sem tocar insumos', async () => {
    const product = makeProduct({ id: 'p1', quantity: 0, recipeId: undefined });
    const repo = new InMemoryRepository({ products: [product] });

    const result = await registerProduction(repo, { productId: 'p1', quantity: 4 }, deps);

    expect(result.ok).toBe(true);
    expect((await repo.listProducts())[0].quantity).toBe(4);
  });
});
