import { describe, expect, it } from 'vitest';
import type { Movement, Recipe } from '../models';
import {
  adjustmentReason,
  buildReport,
  percentChange,
  periodLabel,
  periodRange,
  previousPeriod,
  recipeCost,
  supplyCategory,
  supplyUnitCosts,
} from '../reports';
import { makeMovement, makeProduct, makeSupply } from './factories';

// Todas as datas no fuso local, como o app usa. 13/09/2026 às 15h.
const NOW = new Date(2026, 8, 13, 15, 0);
const at = (day: number, hour = 12, month = 9) =>
  new Date(2026, month - 1, day, hour).toISOString();
const ymd = (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()];

describe('período', () => {
  it('"este mês" vai do dia 1º até o fim de hoje', () => {
    const { start, end } = periodRange({ kind: 'this-month' }, NOW);
    expect(ymd(start)).toEqual([2026, 9, 1]);
    expect(ymd(end)).toEqual([2026, 9, 14]);
  });

  it('"mês passado" é o mês anterior inteiro', () => {
    const { start, end } = periodRange({ kind: 'last-month' }, NOW);
    expect(ymd(start)).toEqual([2026, 8, 1]);
    expect(ymd(end)).toEqual([2026, 9, 1]);
  });

  it('"7 dias" inclui hoje e os 6 dias antes', () => {
    const { start, end } = periodRange({ kind: 'last-7' }, NOW);
    expect(ymd(start)).toEqual([2026, 9, 7]);
    expect(ymd(end)).toEqual([2026, 9, 14]);
  });

  it('um mês escolhido é o mês inteiro, inclusive virando o ano', () => {
    const { start, end } = periodRange({ kind: 'month', year: 2026, month: 12 }, NOW);
    expect(ymd(start)).toEqual([2026, 12, 1]);
    expect(ymd(end)).toEqual([2027, 1, 1]);
  });

  it('"este mês" compara com os mesmos dias do mês passado, não com o mês inteiro', () => {
    const { start, end } = previousPeriod({ kind: 'this-month' }, NOW);
    expect(ymd(start)).toEqual([2026, 8, 1]);
    expect(ymd(end)).toEqual([2026, 8, 14]);
  });

  it('no dia 31, "este mês" não compara além do fim de um mês de 30 dias', () => {
    const { end } = previousPeriod({ kind: 'this-month' }, new Date(2026, 9, 31, 10));
    expect(ymd(end)).toEqual([2026, 10, 1]);
  });

  it('7 e 30 dias comparam com a janela imediatamente anterior', () => {
    const { start, end } = previousPeriod({ kind: 'last-7' }, NOW);
    expect(ymd(start)).toEqual([2026, 8, 31]);
    expect(ymd(end)).toEqual([2026, 9, 7]);
  });

  it('mês escolhido compara com o mês anterior', () => {
    const { start, end } = previousPeriod({ kind: 'month', year: 2026, month: 1 }, NOW);
    expect(ymd(start)).toEqual([2025, 12, 1]);
    expect(ymd(end)).toEqual([2026, 1, 1]);
  });

  it('dá nome ao período', () => {
    expect(periodLabel({ kind: 'this-month' }, NOW)).toBe('1 a 13 de set');
    expect(periodLabel({ kind: 'last-month' }, NOW)).toBe('agosto de 2026');
    expect(periodLabel({ kind: 'last-30' }, NOW)).toBe('15 de ago a 13 de set');
  });

  it('variação percentual sem base não inventa número', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(10, 0)).toBeUndefined();
  });
});

describe('categorias e custos', () => {
  it('deduz a categoria do insumo pelo nome', () => {
    expect(supplyCategory('Cera de coco')).toBe('Cera');
    expect(supplyCategory('Essência Lavanda')).toBe('Essências');
    expect(supplyCategory('Frasco 200g fosco')).toBe('Frascos');
    expect(supplyCategory('Adesivo da sacola')).toBe('Embalagem');
    expect(supplyCategory('Sacola')).toBe('Embalagem');
    expect(supplyCategory('Caixa')).toBe('Embalagem');
    expect(supplyCategory('Adesivo da vela')).toBe('Montagem');
    expect(supplyCategory('Pavio')).toBe('Montagem');
    expect(supplyCategory('Ilhós médio')).toBe('Montagem');
    expect(supplyCategory('Corante')).toBe('Outros');
  });

  it('custo do insumo é a média ponderada das compras com valor, ignorando desfeitas', () => {
    const costs = supplyUnitCosts([
      makeMovement({ type: 'supply_purchase', supplyId: 'cera', quantity: 1000, totalCents: 6000 }),
      makeMovement({
        type: 'supply_purchase',
        supplyId: 'cera',
        quantity: 3000,
        totalCents: 21000,
      }),
      makeMovement({ type: 'supply_purchase', supplyId: 'cera', quantity: 500 }),
      makeMovement({
        type: 'supply_purchase',
        supplyId: 'cera',
        quantity: 1000,
        totalCents: 99999,
        undone: true,
      }),
    ]);
    // (6000 + 21000) / (1000 + 3000) = 6,75 centavos por grama
    expect(costs.get('cera')).toBeCloseTo(6.75);
  });

  it('custo pela ficha técnica aponta os insumos sem custo', () => {
    const recipe: Recipe = {
      id: 'r',
      name: 'ficha',
      items: [
        { supplyId: 'cera', quantityPerUnit: 180 },
        { supplyId: 'pavio', quantityPerUnit: 0.5 },
        { supplyId: 'frasco', quantityPerUnit: 1 },
      ],
    };
    const result = recipeCost(
      recipe,
      new Map([
        ['cera', 6],
        ['pavio', 60],
      ]),
    );
    expect(result).toEqual({ cents: 1110, missing: ['frasco'] });
  });

  it('padroniza o motivo do ajuste para somar junto', () => {
    expect(adjustmentReason('  quebrou ')).toBe('Quebrou');
    expect(adjustmentReason('Brinde')).toBe('Brinde');
    expect(adjustmentReason('')).toBe('Sem motivo');
    expect(adjustmentReason(undefined)).toBe('Sem motivo');
  });
});

describe('buildReport', () => {
  const products = [
    makeProduct({
      id: 'liso-lav',
      model: 'Clássica Liso 90g',
      scent: 'Lavanda',
      priceCents: 3590,
      recipeId: 'r-liso-lav',
    }),
    makeProduct({
      id: 'fosco-lav',
      model: 'Recipiente Fosco 200g',
      scent: 'Lavanda',
      priceCents: 6590,
      recipeId: 'r-fosco-lav',
    }),
    makeProduct({
      id: 'fosco-cafe',
      model: 'Recipiente Fosco 200g',
      scent: 'Café',
      priceCents: 6590,
      recipeId: 'r-fosco-cafe',
    }),
    makeProduct({
      id: 'refinado-cafe',
      model: 'Recipiente Refinado 200g',
      scent: 'Café',
      priceCents: 7590,
    }),
  ];
  const supplies = [
    makeSupply({ id: 'cera', name: 'Cera de coco', unit: 'g' }),
    makeSupply({ id: 'ess-lav', name: 'Essência Lavanda', unit: 'g' }),
    makeSupply({ id: 'ess-cafe', name: 'Essência Café', unit: 'g' }),
    makeSupply({ id: 'frasco', name: 'Frasco 200g fosco', unit: 'un' }),
    makeSupply({ id: 'sacola', name: 'Sacola', unit: 'un' }),
  ];
  const recipes: Recipe[] = [
    {
      id: 'r-liso-lav',
      name: '',
      items: [
        { supplyId: 'cera', quantityPerUnit: 80 },
        { supplyId: 'ess-lav', quantityPerUnit: 10 },
      ],
    },
    {
      id: 'r-fosco-lav',
      name: '',
      items: [
        { supplyId: 'cera', quantityPerUnit: 180 },
        { supplyId: 'ess-lav', quantityPerUnit: 20 },
        { supplyId: 'frasco', quantityPerUnit: 1 },
      ],
    },
    {
      id: 'r-fosco-cafe',
      name: '',
      items: [
        { supplyId: 'cera', quantityPerUnit: 180 },
        { supplyId: 'ess-cafe', quantityPerUnit: 20 },
        { supplyId: 'frasco', quantityPerUnit: 1 },
      ],
    },
  ];
  const september = periodRange({ kind: 'this-month' }, NOW);

  const movements: Movement[] = [
    // vendas de setembro
    makeMovement({
      type: 'sale',
      productId: 'fosco-lav',
      quantity: 2,
      totalCents: 13180,
      occurredAt: at(2),
    }),
    makeMovement({
      type: 'sale',
      productId: 'fosco-lav',
      quantity: 1,
      totalCents: 5931,
      occurredAt: at(5),
    }), // 10% de desconto
    makeMovement({
      type: 'sale',
      productId: 'liso-lav',
      quantity: 1,
      totalCents: 3590,
      occurredAt: at(5, 18),
    }),
    // fora do período e desfeita: não entram
    makeMovement({
      type: 'sale',
      productId: 'liso-lav',
      quantity: 9,
      totalCents: 32310,
      occurredAt: at(20, 12, 8),
    }),
    makeMovement({
      type: 'sale',
      productId: 'liso-lav',
      quantity: 5,
      totalCents: 17950,
      occurredAt: at(6),
      undone: true,
    }),
    // compras (a de agosto só entra no custo, não nos gastos de setembro)
    makeMovement({
      type: 'supply_purchase',
      supplyId: 'cera',
      quantity: 5000,
      totalCents: 30000,
      occurredAt: at(10, 12, 8),
    }),
    makeMovement({
      type: 'supply_purchase',
      supplyId: 'ess-lav',
      quantity: 100,
      totalCents: 4000,
      occurredAt: at(3),
    }),
    makeMovement({
      type: 'supply_purchase',
      supplyId: 'frasco',
      quantity: 10,
      totalCents: 6800,
      occurredAt: at(3),
    }),
    makeMovement({
      type: 'supply_purchase',
      supplyId: 'sacola',
      quantity: 50,
      totalCents: 6000,
      occurredAt: at(4),
    }),
    makeMovement({ type: 'supply_purchase', supplyId: 'sacola', quantity: 20, occurredAt: at(4) }), // sem valor
    // produção consumindo a ficha
    makeMovement({
      type: 'production',
      productId: 'fosco-lav',
      quantity: 2,
      occurredAt: at(4),
      consumed: [
        { supplyId: 'cera', quantity: 360 },
        { supplyId: 'ess-lav', quantity: 40 },
        { supplyId: 'frasco', quantity: 2 },
      ],
    }),
    // saídas que não são venda
    makeMovement({
      type: 'adjustment',
      productId: 'fosco-lav',
      quantity: -1,
      note: 'brinde',
      occurredAt: at(8),
    }),
    makeMovement({
      type: 'adjustment',
      productId: 'liso-lav',
      quantity: -1,
      note: 'Quebrou',
      occurredAt: at(9),
    }),
    makeMovement({
      type: 'adjustment',
      productId: 'liso-lav',
      quantity: 2,
      note: 'Recontagem',
      occurredAt: at(9),
    }),
    makeMovement({
      type: 'adjustment',
      supplyId: 'ess-lav',
      quantity: -15,
      note: 'Derramou',
      occurredAt: at(11),
    }),
  ];

  const report = buildReport({ products, supplies, recipes, movements }, september);

  it('vendas: faturamento, velas, ticket e desconto só do período, sem as desfeitas', () => {
    expect(report.sales.revenueCents).toBe(13180 + 5931 + 3590);
    expect(report.sales.units).toBe(4);
    expect(report.sales.count).toBe(3);
    expect(report.sales.ticketCents).toBe(Math.round(22701 / 3));
    expect(report.sales.discountCents).toBe(6590 - 5931);
    expect(report.sales.discountedCount).toBe(1);
  });

  it('vendas por recipiente mostram também os recipientes que não venderam', () => {
    expect(report.sales.byModel).toEqual([
      { key: 'Recipiente Fosco 200g', label: 'Recipiente Fosco 200g', value: 19111 },
      { key: 'Clássica Liso 90g', label: 'Clássica Liso 90g', value: 3590 },
      { key: 'Recipiente Refinado 200g', label: 'Recipiente Refinado 200g', value: 0 },
    ]);
    expect(report.sales.byScent).toEqual([{ key: 'Lavanda', label: 'Lavanda', value: 4 }]);
  });

  it('faturamento por dia tem um ponto para cada dia do período', () => {
    expect(report.sales.daily).toHaveLength(13);
    expect(report.sales.daily[4]).toMatchObject({ revenueCents: 5931 + 3590, units: 2 });
    expect(report.sales.daily[0].revenueCents).toBe(0);
  });

  it('produção: velas e insumos usados, com custo pelo histórico de compras', () => {
    expect(report.production.units).toBe(2);
    const cera = report.production.suppliesUsed.find((u) => u.supplyId === 'cera');
    expect(cera).toMatchObject({ quantity: 360, costCents: 2160 }); // 360 g × 6 centavos
    expect(report.production.costCents).toBe(2160 + 1600 + 1360);
    expect(report.production.costComplete).toBe(true);
  });

  it('saídas: vendidas e ajustes negativos por motivo; ajuste positivo não é saída', () => {
    expect(report.exits.byReason).toEqual([
      { key: 'Vendidas', label: 'Vendidas', value: 4 },
      { key: 'Brinde', label: 'Brinde', value: 1 },
      { key: 'Quebrou', label: 'Quebrou', value: 1 },
    ]);
    expect(report.exits.supplyLosses).toHaveLength(1);
    expect(report.exits.supplyLosses[0]).toMatchObject({
      reason: 'Derramou',
      units: 15,
      costCents: 600,
    });
  });

  it('gastos: só compras do período com valor, e conta as sem valor', () => {
    expect(report.spending.totalCents).toBe(4000 + 6800 + 6000);
    expect(report.spending.unpricedCount).toBe(1);
    expect(report.spending.byCategory.map((c) => c.key)).toEqual([
      'Frascos',
      'Embalagem',
      'Essências',
    ]);
    const sacola = report.spending.bySupply.find((r) => r.supplyId === 'sacola');
    expect(sacola).toMatchObject({ purchases: 1, quantity: 50, totalCents: 6000 });
  });

  it('margem por recipiente: média dos aromas com custo, e diz o que falta', () => {
    const fosco = report.margins.find((m) => m.model === 'Recipiente Fosco 200g')!;
    // Lavanda tem custo completo: 180×6 + 20×40 + 680 = 2560. Café não (essência sem compra).
    expect(fosco).toMatchObject({ costCents: 2560, aromasWithCost: 1, aromas: 2 });
    expect(fosco.missingSupplies).toEqual(['Essência Café']);

    const refinado = report.margins.find((m) => m.model === 'Recipiente Refinado 200g')!;
    expect(refinado.costCents).toBeUndefined();
  });

  it('lista os lançamentos do período, mais recentes primeiro', () => {
    expect(report.movements[0].occurredAt).toBe(at(11));
    expect(report.movements.every((m) => !m.undone)).toBe(true);
  });
});
