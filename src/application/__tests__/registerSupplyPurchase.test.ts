import { describe, expect, it } from 'vitest';
import { registerSupplyPurchase } from '../registerSupplyPurchase';
import { InMemoryRepository } from '../../infra/storage/InMemoryRepository';
import { makeSupply } from '../../domain/__tests__/factories';

const deps = { now: () => new Date('2026-09-01T12:00:00.000Z'), generateId: () => 'movement-1' };

describe('registerSupplyPurchase (caso de uso)', () => {
  it('soma a quantidade comprada e grava o movimento', async () => {
    const supply = makeSupply({ id: 's1', quantity: 2 });
    const repo = new InMemoryRepository({ supplies: [supply] });

    const result = await registerSupplyPurchase(repo, { supplyId: 's1', quantity: 3.5 }, deps);

    expect(result.ok).toBe(true);
    expect((await repo.listSupplies())[0].quantity).toBe(5.5);
    expect((await repo.listMovements())[0]).toMatchObject({
      type: 'supply_purchase',
      quantity: 3.5,
    });
  });

  it('grava o valor pago quando informado', async () => {
    const repo = new InMemoryRepository({ supplies: [makeSupply({ id: 's1', quantity: 0 })] });

    await registerSupplyPurchase(repo, { supplyId: 's1', quantity: 1000, totalCents: 18000 }, deps);

    expect((await repo.listMovements())[0]).toMatchObject({
      type: 'supply_purchase',
      quantity: 1000,
      totalCents: 18000,
    });
  });

  it('aceita entrada sem valor pago (brinde ou valor desconhecido)', async () => {
    const repo = new InMemoryRepository({ supplies: [makeSupply({ id: 's1' })] });

    await registerSupplyPurchase(repo, { supplyId: 's1', quantity: 5 }, deps);

    expect((await repo.listMovements())[0].totalCents).toBeUndefined();
  });

  it('recusa valor pago negativo ou com fração de centavo, sem mexer no estoque', async () => {
    const repo = new InMemoryRepository({ supplies: [makeSupply({ id: 's1', quantity: 2 })] });

    await expect(
      registerSupplyPurchase(repo, { supplyId: 's1', quantity: 1, totalCents: -100 }, deps),
    ).rejects.toThrow('valor pago');
    await expect(
      registerSupplyPurchase(repo, { supplyId: 's1', quantity: 1, totalCents: 10.5 }, deps),
    ).rejects.toThrow('valor pago');

    expect((await repo.listSupplies())[0].quantity).toBe(2);
    expect(await repo.listMovements()).toHaveLength(0);
  });

  it('falha quando o insumo não existe', async () => {
    const repo = new InMemoryRepository();
    const result = await registerSupplyPurchase(repo, { supplyId: 'missing', quantity: 1 }, deps);
    expect(result).toEqual({ ok: false, reason: 'supply_not_found' });
  });
});
