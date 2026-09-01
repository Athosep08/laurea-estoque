import { describe, expect, it } from 'vitest';
import { InMemoryRepository } from '../InMemoryRepository';
import { eraseAll, exportBackup, importBackup } from '../backup';
import { makeProduct } from '../../../domain/__tests__/factories';

describe('backup', () => {
  it('exporta e reimporta o mesmo estado', async () => {
    const product = makeProduct({ id: 'p1' });
    const repo = new InMemoryRepository({ products: [product] });

    const json = await exportBackup(repo);

    const restoredRepo = new InMemoryRepository();
    const result = await importBackup(restoredRepo, json);

    expect(result).toEqual({ ok: true });
    expect(await restoredRepo.listProducts()).toEqual([product]);
  });

  it('rejeita JSON inválido sem tocar no estado atual', async () => {
    const product = makeProduct({ id: 'p1' });
    const repo = new InMemoryRepository({ products: [product] });

    const result = await importBackup(repo, '{ inválido');

    expect(result).toEqual({ ok: false, reason: 'invalid_json' });
    expect(await repo.listProducts()).toEqual([product]);
  });

  it('eraseAll limpa todas as coleções', async () => {
    const repo = new InMemoryRepository({ products: [makeProduct()] });
    await eraseAll(repo);
    expect(await repo.getState()).toEqual({
      products: [],
      supplies: [],
      recipes: [],
      movements: [],
    });
  });
});
