import { describe, expect, it } from 'vitest';
import { undoMovement } from '../undoMovement';
import { registerProduction } from '../registerProduction';
import { InMemoryRepository } from '../../infra/storage/InMemoryRepository';
import {
  makeMovement,
  makeProduct,
  makeRecipe,
  makeSupply,
} from '../../domain/__tests__/factories';

describe('undoMovement (caso de uso)', () => {
  it('desfaz uma venda devolvendo a quantidade ao estoque', async () => {
    const product = makeProduct({ id: 'p1', quantity: 3 });
    const movement = makeMovement({ id: 'm1', type: 'sale', productId: 'p1', quantity: 2 });
    const repo = new InMemoryRepository({ products: [product], movements: [movement] });

    const result = await undoMovement(repo, 'm1');

    expect(result).toEqual({ ok: true });
    expect((await repo.listProducts())[0].quantity).toBe(5);
    expect((await repo.listMovements())[0].undone).toBe(true);
  });

  it('não desfaz duas vezes o mesmo movimento', async () => {
    const movement = makeMovement({
      id: 'm1',
      type: 'sale',
      productId: 'p1',
      quantity: 1,
      undone: true,
    });
    const repo = new InMemoryRepository({
      products: [makeProduct({ id: 'p1' })],
      movements: [movement],
    });

    expect(await undoMovement(repo, 'm1')).toEqual({ ok: false, reason: 'already_undone' });
  });

  it('desfazer produção devolve exatamente o que foi consumido, mesmo com receita alterada depois', async () => {
    const wax = makeSupply({ id: 'wax', quantity: 10 });
    const recipe = makeRecipe({ id: 'r1', items: [{ supplyId: 'wax', quantityPerUnit: 0.18 }] });
    const product = makeProduct({ id: 'p1', quantity: 0, recipeId: 'r1' });
    const repo = new InMemoryRepository({
      products: [product],
      recipes: [recipe],
      supplies: [wax],
    });

    const production = await registerProduction(
      repo,
      { productId: 'p1', quantity: 10 },
      {
        now: () => new Date('2026-09-01T00:00:00.000Z'),
        generateId: () => 'prod-1',
      },
    );
    expect(production.ok).toBe(true);
    // depois da produção, a receita muda para consumir mais cera por vela
    await repo.saveRecipe({
      id: 'r1',
      name: 'Fosco 200g',
      items: [{ supplyId: 'wax', quantityPerUnit: 0.5 }],
    });

    const result = await undoMovement(repo, 'prod-1');

    expect(result).toEqual({ ok: true });
    expect((await repo.listProducts())[0].quantity).toBe(0);
    // devolve 1.8 (o que foi REALMENTE consumido), não 5 (10 × 0.5, receita nova)
    expect((await repo.listSupplies())[0].quantity).toBeCloseTo(10);
  });

  it('falha sem alterar nada quando desfazer deixaria o produto negativo', async () => {
    const product = makeProduct({ id: 'p1', quantity: 2 });
    const movement = makeMovement({
      id: 'm1',
      type: 'production',
      productId: 'p1',
      quantity: 10,
      consumed: [],
    });
    const repo = new InMemoryRepository({ products: [product], movements: [movement] });

    const result = await undoMovement(repo, 'm1');

    expect(result).toEqual({ ok: false, reason: 'negative_result', resulting: -8 });
    expect((await repo.listProducts())[0].quantity).toBe(2);
    expect((await repo.listMovements())[0].undone).toBe(false);
  });

  it('retorna not_found para movimento inexistente', async () => {
    const repo = new InMemoryRepository();
    expect(await undoMovement(repo, 'inexistente')).toEqual({ ok: false, reason: 'not_found' });
  });
});
