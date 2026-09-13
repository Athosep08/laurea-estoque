import { describe, expect, it } from 'vitest';
import type { Movement, Recipe } from '../../domain/models';
import { makeMovement, makeProduct, makeSupply } from '../../domain/__tests__/factories';
import {
  buildWorkbook,
  workbookFileName,
  type SheetModel,
  type TypedCell,
} from '../reportWorkbook';

const NOW = new Date(2026, 8, 13, 15, 30);
const at = (day: number, hour = 12, month = 9) =>
  new Date(2026, month - 1, day, hour).toISOString();

const products = [
  makeProduct({
    id: 'fosco-lav',
    model: 'Recipiente Fosco 200g',
    scent: 'Lavanda',
    priceCents: 6590,
    quantity: 4,
    minQuantity: 1,
    recipeId: 'r1',
  }),
  makeProduct({
    id: 'liso-cafe',
    model: 'Clássica Liso 90g',
    scent: 'Café',
    priceCents: 3590,
    quantity: 0,
    minQuantity: 1,
  }),
];
const supplies = [
  makeSupply({ id: 'cera', name: 'Cera de coco', unit: 'g', quantity: 5000, minQuantity: 2000 }),
  makeSupply({ id: 'ess-lav', name: 'Essência Lavanda', unit: 'g', quantity: 20, minQuantity: 30 }),
];
const recipes: Recipe[] = [
  {
    id: 'r1',
    name: '',
    items: [
      { supplyId: 'cera', quantityPerUnit: 180 },
      { supplyId: 'ess-lav', quantityPerUnit: 20 },
    ],
  },
];
const movements: Movement[] = [
  makeMovement({
    type: 'sale',
    productId: 'fosco-lav',
    quantity: 2,
    totalCents: 11862,
    occurredAt: at(5),
    note: 'Instagram',
  }),
  makeMovement({
    type: 'sale',
    productId: 'liso-cafe',
    quantity: 1,
    totalCents: 3590,
    occurredAt: at(2),
  }),
  makeMovement({
    type: 'sale',
    productId: 'liso-cafe',
    quantity: 2,
    totalCents: 7180,
    occurredAt: at(3, 12, 8),
  }),
  makeMovement({
    type: 'supply_purchase',
    supplyId: 'cera',
    quantity: 2000,
    totalCents: 12000,
    occurredAt: at(1),
  }),
  makeMovement({ type: 'supply_purchase', supplyId: 'ess-lav', quantity: 50, occurredAt: at(4) }),
  makeMovement({
    type: 'production',
    productId: 'fosco-lav',
    quantity: 1,
    occurredAt: at(6),
    consumed: [
      { supplyId: 'cera', quantity: 180 },
      { supplyId: 'ess-lav', quantity: 20 },
    ],
  }),
  makeMovement({
    type: 'adjustment',
    productId: 'fosco-lav',
    quantity: -1,
    note: 'Brinde',
    occurredAt: at(7),
  }),
];
const input = { products, supplies, recipes, movements };
const thisMonth = { kind: 'this-month' } as const;

const sheet = (sheets: SheetModel[], name: string) => sheets.find((s) => s.name === name)!;
const value = (cell: unknown) =>
  cell && typeof cell === 'object' && !(cell instanceof Date) ? (cell as TypedCell).value : cell;

describe('nome do arquivo', () => {
  it('usa o mês quando o período é um mês fechado', () => {
    expect(workbookFileName('sales', { kind: 'last-month' }, NOW)).toBe(
      'laurea-vendas-2026-08.xlsx',
    );
    expect(workbookFileName('complete', { kind: 'month', year: 2026, month: 7 }, NOW)).toBe(
      'laurea-relatorio-completo-2026-07.xlsx',
    );
  });

  it('usa as datas quando o período é aberto', () => {
    expect(workbookFileName('spending', thisMonth, NOW)).toBe(
      'laurea-gastos-2026-09-01-a-2026-09-13.xlsx',
    );
    expect(workbookFileName('history', { kind: 'last-7' }, NOW)).toBe(
      'laurea-historico-2026-09-07-a-2026-09-13.xlsx',
    );
  });
});

describe('abas de cada relatório', () => {
  it('o completo traz tudo; os específicos, só o que é deles', () => {
    const names = (kind: Parameters<typeof buildWorkbook>[0]) =>
      buildWorkbook(kind, input, thisMonth, NOW).sheets.map((s) => s.name);

    expect(names('complete')).toEqual([
      'Resumo',
      'Vendas',
      'Por vela',
      'Produção',
      'Insumos usados',
      'Entradas de insumo',
      'Gastos por insumo',
      'Saídas por motivo',
      'Perdas e brindes',
      'Estoque de velas',
      'Estoque de insumos',
    ]);
    expect(names('sales')).toEqual(['Resumo', 'Vendas', 'Por vela']);
    expect(names('spending')).toEqual(['Resumo', 'Entradas de insumo', 'Gastos por insumo']);
    expect(names('history')).toEqual(['Lançamentos']);
  });

  it('nome de aba cabe no limite de 31 caracteres do Excel', () => {
    for (const s of buildWorkbook('complete', input, thisMonth, NOW).sheets) {
      expect(s.name.length).toBeLessThanOrEqual(31);
    }
  });
});

describe('conteúdo', () => {
  const { sheets } = buildWorkbook('complete', input, thisMonth, NOW);

  it('Resumo compara com o período anterior, com dinheiro em reais', () => {
    const resumo = sheet(sheets, 'Resumo');
    const row = (label: string) => resumo.rows.find((r) => r[0] === label)!;

    expect(row('Faturamento').slice(1).map(value)).toEqual([154.52, 71.8, (15452 - 7180) / 7180]);
    expect((row('Faturamento')[1] as TypedCell).kind).toBe('money');
    expect(row('Velas vendidas').slice(1, 3).map(value)).toEqual([3, 2]);
    expect(value(row('Gastos com insumo')[3])).toBeNull(); // sem gasto antes: sem variação
    expect(
      row('Entradas de insumo sem valor pago (fora dos gastos)').slice(1, 2).map(value),
    ).toEqual([1]);
    expect(resumo.preamble?.[1]).toEqual(['Período', '1 a 13 de set (01/09/2026 a 13/09/2026)']);
  });

  it('Vendas em ordem de data, com desconto calculado e linha de total', () => {
    const vendas = sheet(sheets, 'Vendas');
    expect(vendas.rows).toEqual([
      [new Date(at(2)), 'Clássica Liso 90g', 'Café', 1, 35.9, 35.9, 0, ''],
      [new Date(at(5)), 'Recipiente Fosco 200g', 'Lavanda', 2, 131.8, 118.62, 13.18, 'Instagram'],
    ]);
    expect(vendas.total).toEqual(['Total', null, null, 3, 167.7, 154.52, 13.18, null]);
  });

  it('Produção traz o custo pelos insumos consumidos, ou vazio se faltar custo', () => {
    // A essência Lavanda só teve entrada sem valor: custo desconhecido.
    expect(sheet(sheets, 'Produção').rows[0].slice(1, 5)).toEqual([
      'Recipiente Fosco 200g',
      'Lavanda',
      1,
      null,
    ]);
    const usados = sheet(sheets, 'Insumos usados').rows;
    expect(usados).toContainEqual(['Cera de coco', 'Cera', 180, 'g', 10.8]);
    expect(usados).toContainEqual(['Essência Lavanda', 'Essências', 20, 'g', null]);
  });

  it('Entradas de insumo mostram o valor pago e o custo por unidade', () => {
    const entradas = sheet(sheets, 'Entradas de insumo');
    expect(entradas.rows[0].slice(1, 7)).toEqual([
      'Cera de coco',
      'Cera',
      2000,
      'g',
      120,
      'R$ 60,00 por kg',
    ]);
    expect(entradas.rows[1].slice(5, 7)).toEqual([null, 'sem valor pago']);
    expect(entradas.total?.[5]).toBe(120);
  });

  it('Saídas e perdas separam o que foi vendido do que foi brinde', () => {
    expect(sheet(sheets, 'Saídas por motivo').rows).toEqual([
      ['Vendidas', 3],
      ['Brinde', 1],
    ]);
    expect(sheet(sheets, 'Perdas e brindes').rows[0].slice(1, 6)).toEqual([
      'Vela',
      'Lavanda · Recipiente Fosco 200g',
      1,
      'un.',
      'Brinde',
    ]);
  });

  it('Estoque aponta o que está zerado, baixo ou abaixo do mínimo', () => {
    const velas = sheet(sheets, 'Estoque de velas').rows;
    expect(velas.find((r) => r[1] === 'Café')?.[5]).toBe('Zerado');
    expect(velas.find((r) => r[1] === 'Lavanda')?.[5]).toBe('OK');
    const insumos = sheet(sheets, 'Estoque de insumos').rows;
    expect(insumos.find((r) => r[0] === 'Essência Lavanda')?.slice(5)).toEqual([
      'Abaixo do mínimo',
      'sem custo',
    ]);
    expect(insumos.find((r) => r[0] === 'Cera de coco')?.slice(5)).toEqual([
      'OK',
      'R$ 60,00 por kg',
    ]);
  });

  it('Por vela lista todas as velas, inclusive as que não venderam', () => {
    expect(sheet(sheets, 'Por vela').rows).toEqual([
      ['Clássica Liso 90g', 'Café', 0, 1, 35.9, 0],
      ['Recipiente Fosco 200g', 'Lavanda', 1, 2, 118.62, 4],
    ]);
  });
});
