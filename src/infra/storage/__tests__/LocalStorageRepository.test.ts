import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageRepository } from '../LocalStorageRepository';
import { makeProduct, makeMovement } from '../../../domain/__tests__/factories';

describe('LocalStorageRepository', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('começa vazio quando não há nada salvo', () => {
    const repo = new LocalStorageRepository();
    expect(repo.listProducts()).toEqual([]);
    expect(repo.listMovements()).toEqual([]);
  });

  it('persiste e recupera um produto entre instâncias', () => {
    const product = makeProduct({ id: 'p1' });
    new LocalStorageRepository().saveProduct(product);

    const repo2 = new LocalStorageRepository();
    expect(repo2.listProducts()).toEqual([product]);
  });

  it('atualiza um produto existente em vez de duplicar', () => {
    const repo = new LocalStorageRepository();
    const product = makeProduct({ id: 'p1', quantity: 5 });
    repo.saveProduct(product);
    repo.saveProduct({ ...product, quantity: 9 });

    expect(repo.listProducts()).toEqual([{ ...product, quantity: 9 }]);
  });

  it('acrescenta movimentos sem sobrescrever os anteriores', () => {
    const repo = new LocalStorageRepository();
    const m1 = makeMovement({ id: 'm1' });
    const m2 = makeMovement({ id: 'm2' });
    repo.appendMovement(m1);
    repo.appendMovement(m2);

    expect(repo.listMovements()).toEqual([m1, m2]);
  });

  it('marca um movimento como desfeito via updateMovement', () => {
    const repo = new LocalStorageRepository();
    const movement = makeMovement({ id: 'm1', undone: false });
    repo.appendMovement(movement);
    repo.updateMovement({ ...movement, undone: true });

    expect(repo.listMovements()).toEqual([{ ...movement, undone: true }]);
  });

  it('ignora JSON corrompido e volta a um estado vazio', () => {
    window.localStorage.setItem('laurea-estoque', '{ isto não é json');
    const repo = new LocalStorageRepository();
    expect(repo.listProducts()).toEqual([]);
  });
});
