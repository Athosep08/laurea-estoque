import { describe, expect, it } from 'vitest';
import { registerSupplyPurchase } from '../registerSupplyPurchase';
import { InMemoryRepository } from '../../infra/storage/InMemoryRepository';
import { makeSupply } from '../../domain/__tests__/factories';

const deps = { now: () => new Date('2026-09-01T12:00:00.000Z'), generateId: () => 'movement-1' };

describe('registerSupplyPurchase (caso de uso)', () => {
  it('soma a quantidade comprada e grava o movimento', () => {
    const supply = makeSupply({ id: 's1', quantity: 2 });
    const repo = new InMemoryRepository({ supplies: [supply] });

    const result = registerSupplyPurchase(repo, { supplyId: 's1', quantity: 3.5 }, deps);

    expect(result.ok).toBe(true);
    expect(repo.listSupplies()[0].quantity).toBe(5.5);
    expect(repo.listMovements()[0]).toMatchObject({ type: 'supply_purchase', quantity: 3.5 });
  });

  it('falha quando o insumo não existe', () => {
    const repo = new InMemoryRepository();
    const result = registerSupplyPurchase(repo, { supplyId: 'missing', quantity: 1 }, deps);
    expect(result).toEqual({ ok: false, reason: 'supply_not_found' });
  });
});
