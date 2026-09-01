import { describe, expect, it } from 'vitest';
import { adjustStock } from '../adjustStock';
import { InMemoryRepository } from '../../infra/storage/InMemoryRepository';
import { makeProduct, makeSupply } from '../../domain/__tests__/factories';

const deps = { now: () => new Date('2026-09-01T12:00:00.000Z'), generateId: () => 'movement-1' };

describe('adjustStock (caso de uso)', () => {
  it('exige nota explicando o ajuste', async () => {
    const product = makeProduct({ id: 'p1' });
    const repo = new InMemoryRepository({ products: [product] });

    const result = await adjustStock(
      repo,
      { target: 'product', id: 'p1', delta: -1, note: '  ' },
      deps,
    );

    expect(result).toEqual({ ok: false, reason: 'note_required' });
    expect(await repo.listMovements()).toHaveLength(0);
  });

  it('ajusta um produto e grava o movimento com o delta', async () => {
    const product = makeProduct({ id: 'p1', quantity: 5 });
    const repo = new InMemoryRepository({ products: [product] });

    const result = await adjustStock(
      repo,
      { target: 'product', id: 'p1', delta: -2, note: 'quebra no transporte' },
      deps,
    );

    expect(result.ok).toBe(true);
    expect((await repo.listProducts())[0].quantity).toBe(3);
    expect((await repo.listMovements())[0]).toMatchObject({ type: 'adjustment', quantity: -2 });
  });

  it('ajusta um insumo aceitando delta positivo', async () => {
    const supply = makeSupply({ id: 's1', quantity: 2 });
    const repo = new InMemoryRepository({ supplies: [supply] });

    const result = await adjustStock(
      repo,
      { target: 'supply', id: 's1', delta: 3, note: 'recontagem' },
      deps,
    );

    expect(result.ok).toBe(true);
    expect((await repo.listSupplies())[0].quantity).toBe(5);
  });

  it('recusa ajuste que deixaria a quantidade negativa', async () => {
    const product = makeProduct({ id: 'p1', quantity: 1 });
    const repo = new InMemoryRepository({ products: [product] });

    const result = await adjustStock(
      repo,
      { target: 'product', id: 'p1', delta: -5, note: 'perda' },
      deps,
    );

    expect(result).toEqual({ ok: false, reason: 'negative_result', resulting: -4 });
    expect((await repo.listProducts())[0].quantity).toBe(1);
  });
});
