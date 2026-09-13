import { describe, expect, it } from 'vitest';
import { getMonthlyReport } from '../report';
import { makeMovement, makeProduct } from './factories';

describe('getMonthlyReport', () => {
  it('agrega apenas os movimentos do mês pedido', () => {
    const product = makeProduct({ id: 'p1', quantity: 7 });
    const movements = [
      makeMovement({
        type: 'sale',
        productId: 'p1',
        quantity: 2,
        totalCents: 7180,
        occurredAt: '2026-08-10T10:00:00.000Z',
      }),
      makeMovement({
        type: 'sale',
        productId: 'p1',
        quantity: 1,
        totalCents: 3590,
        occurredAt: '2026-09-05T10:00:00.000Z',
      }),
    ];

    const report = getMonthlyReport(2026, 9, movements, [product]);

    expect(report.totalSold).toBe(1);
    expect(report.totalRevenueCents).toBe(3590);
    expect(report.movements).toHaveLength(1);
  });

  it('ignora movimentos desfeitos', () => {
    const product = makeProduct({ id: 'p1', quantity: 5 });
    const movements = [
      makeMovement({
        type: 'sale',
        productId: 'p1',
        quantity: 3,
        totalCents: 10770,
        occurredAt: '2026-09-05T10:00:00.000Z',
        undone: true,
      }),
    ];

    const report = getMonthlyReport(2026, 9, movements, [product]);

    expect(report.totalSold).toBe(0);
    expect(report.totalRevenueCents).toBe(0);
    expect(report.movements).toHaveLength(0);
  });

  it('soma produção, vendas e faturamento, e traz a quebra por produto com estoque atual', () => {
    const classic = makeProduct({ id: 'classic', model: 'Clássica Liso 90g', quantity: 12 });
    const fosco = makeProduct({ id: 'fosco', model: 'Recipiente Fosco 200g', quantity: 4 });

    const movements = [
      makeMovement({
        type: 'production',
        productId: 'classic',
        quantity: 10,
        occurredAt: '2026-09-01T09:00:00.000Z',
      }),
      makeMovement({
        type: 'sale',
        productId: 'classic',
        quantity: 4,
        totalCents: 14360,
        occurredAt: '2026-09-02T09:00:00.000Z',
      }),
      makeMovement({
        type: 'sale',
        productId: 'fosco',
        quantity: 1,
        totalCents: 6590,
        occurredAt: '2026-09-03T09:00:00.000Z',
      }),
      makeMovement({
        type: 'adjustment',
        productId: 'classic',
        quantity: -1,
        note: 'quebra',
        occurredAt: '2026-09-04T09:00:00.000Z',
      }),
    ];

    const report = getMonthlyReport(2026, 9, movements, [classic, fosco]);

    expect(report.totalProduced).toBe(10);
    expect(report.totalSold).toBe(5);
    expect(report.totalRevenueCents).toBe(14360 + 6590);

    const classicRow = report.byProduct.find((row) => row.productId === 'classic');
    const foscoRow = report.byProduct.find((row) => row.productId === 'fosco');

    expect(classicRow).toMatchObject({
      produced: 10,
      sold: 4,
      revenueCents: 14360,
      currentStock: 12,
    });
    expect(foscoRow).toMatchObject({
      produced: 0,
      sold: 1,
      revenueCents: 6590,
      currentStock: 4,
    });

    // mais recentes primeiro
    expect(report.movements[0].occurredAt).toBe('2026-09-04T09:00:00.000Z');
    expect(report.movements.at(-1)?.occurredAt).toBe('2026-09-01T09:00:00.000Z');
  });

  it('não quebra o mês de referência com new Date() implícito — depende só dos parâmetros', () => {
    const product = makeProduct({ id: 'p1' });
    const movements = [
      makeMovement({
        type: 'sale',
        productId: 'p1',
        quantity: 1,
        totalCents: 100,
        occurredAt: '2020-01-15T00:00:00.000Z',
      }),
    ];

    const report = getMonthlyReport(2020, 1, movements, [product]);
    expect(report.totalSold).toBe(1);
  });

  it('não conta o valor pago em compra de insumo como faturamento', () => {
    const product = makeProduct({ id: 'p1', priceCents: 3590 });
    const report = getMonthlyReport(
      2026,
      9,
      [
        makeMovement({
          type: 'sale',
          productId: 'p1',
          quantity: 1,
          totalCents: 3590,
          occurredAt: '2026-09-10T12:00:00.000Z',
        }),
        makeMovement({
          type: 'supply_purchase',
          productId: undefined,
          supplyId: 's1',
          quantity: 1000,
          totalCents: 18000,
          occurredAt: '2026-09-10T13:00:00.000Z',
        }),
      ],
      [product],
    );

    expect(report.totalRevenueCents).toBe(3590);
  });
});
