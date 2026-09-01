import { describe, expect, it } from 'vitest';
import { getMonthlyReport } from '../getMonthlyReport';
import { InMemoryRepository } from '../../infra/storage/InMemoryRepository';
import { makeMovement, makeProduct } from '../../domain/__tests__/factories';

describe('getMonthlyReport (caso de uso)', () => {
  it('lê movimentos e produtos do repositório e delega a agregação ao domínio', () => {
    const product = makeProduct({ id: 'p1', quantity: 4 });
    const movement = makeMovement({
      type: 'sale',
      productId: 'p1',
      quantity: 1,
      totalCents: 3590,
      occurredAt: '2026-09-10T00:00:00.000Z',
    });
    const repo = new InMemoryRepository({ products: [product], movements: [movement] });

    const report = getMonthlyReport(repo, 2026, 9);

    expect(report.totalSold).toBe(1);
    expect(report.totalRevenueCents).toBe(3590);
  });
});
