import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageRepository } from '../LocalStorageRepository';
import { makeProduct } from '../../../domain/__tests__/factories';

describe('LocalStorageRepository', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('começa vazio quando não há nada salvo', async () => {
    const repo = new LocalStorageRepository();
    expect(await repo.listProducts()).toEqual([]);
    expect(await repo.listMovements()).toEqual([]);
  });

  it('persiste e recupera um produto entre instâncias', async () => {
    const product = makeProduct({ id: 'p1' });
    await new LocalStorageRepository().saveProduct(product);

    const repo2 = new LocalStorageRepository();
    expect(await repo2.listProducts()).toEqual([product]);
  });

  it('atualiza um produto existente em vez de duplicar', async () => {
    const repo = new LocalStorageRepository();
    const product = makeProduct({ id: 'p1', quantity: 5 });
    await repo.saveProduct(product);
    await repo.saveProduct({ ...product, quantity: 9 });

    expect(await repo.listProducts()).toEqual([{ ...product, quantity: 9 }]);
  });

  it('acrescenta movimentos sem sobrescrever os anteriores', async () => {
    const repo = new LocalStorageRepository();
    const product = makeProduct({ id: 'p1', quantity: 10 });
    await repo.saveProduct(product);

    await repo.registerSale({ productId: 'p1', quantity: 1 });
    await repo.registerSale({ productId: 'p1', quantity: 1 });

    const movements = await repo.listMovements();
    expect(movements).toHaveLength(2);
    expect(movements.map((m) => m.type)).toEqual(['sale', 'sale']);
  });

  it('marca um movimento como desfeito via undoMovement', async () => {
    const repo = new LocalStorageRepository();
    const product = makeProduct({ id: 'p1', quantity: 10 });
    await repo.saveProduct(product);

    const sale = await repo.registerSale({ productId: 'p1', quantity: 1 });
    if (!sale.ok) throw new Error('esperava sucesso');

    const result = await repo.undoMovement(sale.movement.id);
    expect(result).toEqual({ ok: true });

    const movements = await repo.listMovements();
    expect(movements.find((m) => m.id === sale.movement.id)?.undone).toBe(true);
  });

  it('ignora JSON corrompido e volta a um estado vazio', async () => {
    window.localStorage.setItem('laurea-estoque', '{ isto não é json');
    const repo = new LocalStorageRepository();
    expect(await repo.listProducts()).toEqual([]);
  });
});
