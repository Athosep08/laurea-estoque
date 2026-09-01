import { describe, expect, it } from 'vitest';
import { InMemoryRepository } from '../InMemoryRepository';
import { eraseAll, exportBackup, importBackup } from '../backup';
import { makeProduct } from '../../../domain/__tests__/factories';

describe('backup', () => {
  it('exporta e reimporta o mesmo estado', () => {
    const product = makeProduct({ id: 'p1' });
    const repo = new InMemoryRepository({ products: [product] });

    const json = exportBackup(repo);

    const restoredRepo = new InMemoryRepository();
    const result = importBackup(restoredRepo, json);

    expect(result).toEqual({ ok: true });
    expect(restoredRepo.listProducts()).toEqual([product]);
  });

  it('rejeita JSON inválido sem tocar no estado atual', () => {
    const product = makeProduct({ id: 'p1' });
    const repo = new InMemoryRepository({ products: [product] });

    const result = importBackup(repo, '{ inválido');

    expect(result).toEqual({ ok: false, reason: 'invalid_json' });
    expect(repo.listProducts()).toEqual([product]);
  });

  it('eraseAll limpa todas as coleções', () => {
    const repo = new InMemoryRepository({ products: [makeProduct()] });
    eraseAll(repo);
    expect(repo.getState()).toEqual({
      products: [],
      supplies: [],
      recipes: [],
      movements: [],
    });
  });
});
