import type { Movement, Product, Supply } from '../domain/models';
import { isLowStock } from '../domain/inventory';
import { formatUnitCost } from '../domain/money';
import {
  buildReport,
  isWholeMonth,
  periodLabel,
  periodRange,
  previousPeriod,
  supplyCategory,
  supplyUnitCosts,
  type Period,
  type PeriodChoice,
  type Report,
  type ReportInput,
} from '../domain/reports';

/**
 * Monta a planilha de um relatório: abas, colunas e linhas, sem saber nada
 * de .xlsx. Quem grava o arquivo é o adaptador em `infra/export`. Assim o
 * conteúdo da planilha é testável sem biblioteca nenhuma.
 *
 * Valores em dinheiro vão como número em reais (não texto "R$ 35,90"), para
 * dar para somar e filtrar no Excel; o formato de moeda é aplicado pela coluna.
 */

export type CellKind = 'text' | 'integer' | 'number' | 'money' | 'percent' | 'datetime';
export type CellValue = string | number | Date | null;
/** Célula com formato próprio, para colunas que misturam tipos (a aba Resumo). */
export type TypedCell = { value: CellValue; kind: CellKind };

export type SheetModel = {
  name: string;
  /** Linhas de cabeçalho antes da tabela (título, período...). */
  preamble?: CellValue[][];
  columns: { header: string; kind: CellKind; width: number }[];
  rows: (CellValue | TypedCell)[][];
  /** Linha de total, em negrito, no fim da tabela. */
  total?: (CellValue | TypedCell)[];
};

export type WorkbookModel = { fileName: string; sheets: SheetModel[] };

/** O relatório completo, ou só as abas de um relatório. */
export type WorkbookKind = 'complete' | 'sales' | 'production' | 'exits' | 'spending' | 'history';

const SHEETS_BY_KIND: Record<WorkbookKind, SheetId[]> = {
  complete: [
    'summary',
    'sales',
    'byProduct',
    'production',
    'suppliesUsed',
    'purchases',
    'spendingBySupply',
    'exitsByReason',
    'losses',
    'productStock',
    'supplyStock',
  ],
  sales: ['summary', 'sales', 'byProduct'],
  production: ['summary', 'production', 'suppliesUsed'],
  exits: ['summary', 'exitsByReason', 'losses'],
  spending: ['summary', 'purchases', 'spendingBySupply'],
  history: ['movements'],
};

const FILE_SLUG: Record<WorkbookKind, string> = {
  complete: 'relatorio-completo',
  sales: 'vendas',
  production: 'producao',
  exits: 'saidas-de-estoque',
  spending: 'gastos',
  history: 'historico',
};

type SheetId =
  | 'summary'
  | 'sales'
  | 'byProduct'
  | 'production'
  | 'suppliesUsed'
  | 'purchases'
  | 'spendingBySupply'
  | 'exitsByReason'
  | 'losses'
  | 'productStock'
  | 'supplyStock'
  | 'movements';

const reais = (cents: number | undefined) => (cents === undefined ? null : cents / 100);
const money = (cents: number | undefined): TypedCell => ({ value: reais(cents), kind: 'money' });
const integer = (value: number): TypedCell => ({ value, kind: 'integer' });

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const brDay = (date: Date) =>
  `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
const lastDay = (period: Period) =>
  new Date(period.end.getFullYear(), period.end.getMonth(), period.end.getDate() - 1);

/** "laurea-vendas-2026-08.xlsx" quando o período é um mês inteiro; "…-2026-09-01-a-2026-09-13.xlsx" para os outros. */
export function workbookFileName(kind: WorkbookKind, choice: PeriodChoice, now: Date): string {
  const period = periodRange(choice, now);
  const span = isWholeMonth(period)
    ? `${period.start.getFullYear()}-${pad(period.start.getMonth() + 1)}`
    : `${isoDay(period.start)}-a-${isoDay(lastDay(period))}`;
  return `laurea-${FILE_SLUG[kind]}-${span}.xlsx`;
}

type Context = {
  input: ReportInput;
  report: Report;
  previous: Report;
  period: Period;
  previousRange: Period;
  label: string;
  now: Date;
  productById: Map<string, Product>;
  supplyById: Map<string, Supply>;
  unitCosts: Map<string, number>;
};

export function buildWorkbook(
  kind: WorkbookKind,
  input: ReportInput,
  choice: PeriodChoice,
  now: Date,
): WorkbookModel {
  const period = periodRange(choice, now);
  const previousRange = previousPeriod(choice, now);
  const context: Context = {
    input,
    report: buildReport(input, period),
    previous: buildReport(input, previousRange),
    period,
    previousRange,
    label: periodLabel(choice, now),
    now,
    productById: new Map(input.products.map((p) => [p.id, p])),
    supplyById: new Map(input.supplies.map((s) => [s.id, s])),
    unitCosts: supplyUnitCosts(input.movements),
  };
  return {
    fileName: workbookFileName(kind, choice, now),
    sheets: SHEETS_BY_KIND[kind].map((id) => SHEET_BUILDERS[id](context)),
  };
}

// ---------------------------------------------------------------------------
// Abas
// ---------------------------------------------------------------------------

const chronological = (movements: Movement[]) =>
  [...movements].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
const at = (movement: Movement) => new Date(movement.occurredAt);

function productNames(context: Context, productId: string | undefined) {
  const product = context.productById.get(productId ?? '');
  return { model: product?.model ?? 'Vela removida', scent: product?.scent ?? '' };
}

function supplyInfo(context: Context, supplyId: string | undefined) {
  const supply = context.supplyById.get(supplyId ?? '');
  const name = supply?.name ?? 'Insumo removido';
  return { name, unit: supply?.unit ?? '', category: supplyCategory(name) };
}

/** Custo de uma produção pelos insumos que ela consumiu; `undefined` se faltar algum custo. */
function productionCost(context: Context, movement: Movement): number | undefined {
  let cents = 0;
  for (const consumed of movement.consumed ?? []) {
    const unitCost = context.unitCosts.get(consumed.supplyId);
    if (unitCost === undefined) return undefined;
    cents += unitCost * consumed.quantity;
  }
  return Math.round(cents);
}

function summary(context: Context): SheetModel {
  const { report, previous, period, previousRange, now, label } = context;
  const lostUnits = (r: Report) =>
    r.exits.byReason.filter((x) => x.key !== 'Vendidas').reduce((t, x) => t + x.value, 0);
  const change = (current: number, before: number): TypedCell => ({
    value: before === 0 ? null : (current - before) / before,
    kind: 'percent',
  });
  const moneyRow = (name: string, current: number, before: number) => [
    name,
    money(current),
    money(before),
    change(current, before),
  ];
  const countRow = (name: string, current: number, before: number) => [
    name,
    integer(current),
    integer(before),
    change(current, before),
  ];

  return {
    name: 'Resumo',
    preamble: [
      ["L'AUREA Aromas — relatório"],
      ['Período', `${label} (${brDay(period.start)} a ${brDay(lastDay(period))})`],
      ['Comparado com', `${brDay(previousRange.start)} a ${brDay(lastDay(previousRange))}`],
      ['Gerado em', now],
    ],
    columns: [
      { header: 'Indicador', kind: 'text', width: 44 },
      { header: 'No período', kind: 'text', width: 16 },
      { header: 'Período anterior', kind: 'text', width: 18 },
      { header: 'Variação', kind: 'text', width: 12 },
    ],
    rows: [
      moneyRow('Faturamento', report.sales.revenueCents, previous.sales.revenueCents),
      moneyRow('Gastos com insumo', report.spending.totalCents, previous.spending.totalCents),
      moneyRow(
        'Sobrou (vendas menos compras de insumo)',
        report.sales.revenueCents - report.spending.totalCents,
        previous.sales.revenueCents - previous.spending.totalCents,
      ),
      countRow('Velas vendidas', report.sales.units, previous.sales.units),
      countRow('Número de vendas', report.sales.count, previous.sales.count),
      moneyRow('Ticket médio', report.sales.ticketCents, previous.sales.ticketCents),
      moneyRow('Descontos dados', report.sales.discountCents, previous.sales.discountCents),
      countRow('Velas produzidas', report.production.units, previous.production.units),
      moneyRow(
        report.production.costComplete
          ? 'Custo estimado da produção'
          : 'Custo estimado da produção (parcial: há insumo sem custo)',
        report.production.costCents,
        previous.production.costCents,
      ),
      countRow(
        'Velas que saíram sem venda (brindes, quebras…)',
        lostUnits(report),
        lostUnits(previous),
      ),
      countRow(
        'Entradas de insumo sem valor pago (fora dos gastos)',
        report.spending.unpricedCount,
        previous.spending.unpricedCount,
      ),
    ],
  };
}

function sales(context: Context): SheetModel {
  const list = chronological(context.report.sales.list);
  // Somas em centavos: somar reais (35.9 + 131.8) acumula erro de ponto flutuante.
  let listTotal = 0;
  let chargedTotal = 0;
  let discountTotal = 0;
  const rows = list.map((sale) => {
    const { model, scent } = productNames(context, sale.productId);
    const product = context.productById.get(sale.productId ?? '');
    const listCents = product ? product.priceCents * sale.quantity : undefined;
    const charged = sale.totalCents ?? 0;
    const discount = listCents === undefined ? undefined : Math.max(0, listCents - charged);
    listTotal += listCents ?? 0;
    chargedTotal += charged;
    discountTotal += discount ?? 0;
    return [
      at(sale),
      model,
      scent,
      sale.quantity,
      reais(listCents),
      reais(charged),
      reais(discount),
      sale.note ?? '',
    ];
  });
  return {
    name: 'Vendas',
    columns: [
      { header: 'Data', kind: 'datetime', width: 17 },
      { header: 'Recipiente', kind: 'text', width: 26 },
      { header: 'Aroma', kind: 'text', width: 20 },
      { header: 'Quantidade', kind: 'integer', width: 11 },
      { header: 'Valor de tabela', kind: 'money', width: 15 },
      { header: 'Valor cobrado', kind: 'money', width: 15 },
      { header: 'Desconto', kind: 'money', width: 12 },
      { header: 'Observação', kind: 'text', width: 30 },
    ],
    rows,
    total: rows.length
      ? [
          'Total',
          null,
          null,
          context.report.sales.units,
          reais(listTotal),
          reais(chargedTotal),
          reais(discountTotal),
          null,
        ]
      : undefined,
  };
}

function byProduct(context: Context): SheetModel {
  const stats = new Map<string, { produced: number; sold: number; revenue: number }>();
  const entry = (id: string) => {
    const current = stats.get(id) ?? { produced: 0, sold: 0, revenue: 0 };
    stats.set(id, current);
    return current;
  };
  for (const sale of context.report.sales.list) {
    const e = entry(sale.productId ?? '');
    e.sold += sale.quantity;
    e.revenue += sale.totalCents ?? 0;
  }
  for (const production of context.report.production.list) {
    entry(production.productId ?? '').produced += production.quantity;
  }
  const products = [...context.input.products].sort(
    (a, b) => a.model.localeCompare(b.model, 'pt-BR') || a.scent.localeCompare(b.scent, 'pt-BR'),
  );
  return {
    name: 'Por vela',
    columns: [
      { header: 'Recipiente', kind: 'text', width: 26 },
      { header: 'Aroma', kind: 'text', width: 20 },
      { header: 'Produzidas', kind: 'integer', width: 11 },
      { header: 'Vendidas', kind: 'integer', width: 10 },
      { header: 'Faturamento', kind: 'money', width: 14 },
      { header: 'Estoque atual', kind: 'integer', width: 13 },
    ],
    rows: products.map((p) => {
      const s = stats.get(p.id) ?? { produced: 0, sold: 0, revenue: 0 };
      return [p.model, p.scent, s.produced, s.sold, reais(s.revenue), p.quantity];
    }),
  };
}

function production(context: Context): SheetModel {
  const rows = chronological(context.report.production.list).map((movement) => {
    const { model, scent } = productNames(context, movement.productId);
    return [
      at(movement),
      model,
      scent,
      movement.quantity,
      reais(productionCost(context, movement)),
      movement.note ?? '',
    ];
  });
  return {
    name: 'Produção',
    columns: [
      { header: 'Data', kind: 'datetime', width: 17 },
      { header: 'Recipiente', kind: 'text', width: 26 },
      { header: 'Aroma', kind: 'text', width: 20 },
      { header: 'Quantidade', kind: 'integer', width: 11 },
      { header: 'Custo estimado', kind: 'money', width: 15 },
      { header: 'Observação', kind: 'text', width: 30 },
    ],
    rows,
    total: rows.length
      ? ['Total', null, null, rows.reduce((t, r) => t + (r[3] as number), 0), null, null]
      : undefined,
  };
}

function suppliesUsed(context: Context): SheetModel {
  return {
    name: 'Insumos usados',
    columns: [
      { header: 'Insumo', kind: 'text', width: 30 },
      { header: 'Categoria', kind: 'text', width: 12 },
      { header: 'Quantidade', kind: 'number', width: 12 },
      { header: 'Unidade', kind: 'text', width: 9 },
      { header: 'Custo', kind: 'money', width: 13 },
    ],
    rows: context.report.production.suppliesUsed.map((use) => [
      use.name,
      supplyCategory(use.name),
      use.quantity,
      use.unit,
      reais(use.costCents),
    ]),
  };
}

function purchases(context: Context): SheetModel {
  const list = chronological(context.report.movements.filter((m) => m.type === 'supply_purchase'));
  const rows = list.map((purchase) => {
    const { name, unit, category } = supplyInfo(context, purchase.supplyId);
    return [
      at(purchase),
      name,
      category,
      purchase.quantity,
      unit,
      reais(purchase.totalCents),
      purchase.totalCents === undefined || !(purchase.quantity > 0)
        ? 'sem valor pago'
        : formatUnitCost(purchase.totalCents, purchase.quantity, unit),
      purchase.note ?? '',
    ];
  });
  return {
    name: 'Entradas de insumo',
    columns: [
      { header: 'Data', kind: 'datetime', width: 17 },
      { header: 'Insumo', kind: 'text', width: 30 },
      { header: 'Categoria', kind: 'text', width: 12 },
      { header: 'Quantidade', kind: 'number', width: 12 },
      { header: 'Unidade', kind: 'text', width: 9 },
      { header: 'Valor pago', kind: 'money', width: 13 },
      { header: 'Custo por unidade', kind: 'text', width: 20 },
      { header: 'Observação', kind: 'text', width: 30 },
    ],
    rows,
    total: rows.length
      ? ['Total', null, null, null, null, reais(context.report.spending.totalCents), null, null]
      : undefined,
  };
}

function spendingBySupply(context: Context): SheetModel {
  return {
    name: 'Gastos por insumo',
    columns: [
      { header: 'Insumo', kind: 'text', width: 30 },
      { header: 'Categoria', kind: 'text', width: 12 },
      { header: 'Compras', kind: 'integer', width: 10 },
      { header: 'Quantidade', kind: 'number', width: 12 },
      { header: 'Unidade', kind: 'text', width: 9 },
      { header: 'Total pago', kind: 'money', width: 13 },
      { header: 'Custo médio', kind: 'text', width: 20 },
    ],
    rows: context.report.spending.bySupply.map((row) => [
      row.name,
      row.category,
      row.purchases,
      row.quantity,
      row.unit,
      reais(row.totalCents),
      formatUnitCost(row.totalCents, row.quantity, row.unit),
    ]),
    total: context.report.spending.bySupply.length
      ? ['Total', null, null, null, null, reais(context.report.spending.totalCents), null]
      : undefined,
  };
}

function exitsByReason(context: Context): SheetModel {
  return {
    name: 'Saídas por motivo',
    columns: [
      { header: 'Motivo', kind: 'text', width: 24 },
      { header: 'Velas', kind: 'integer', width: 10 },
    ],
    rows: context.report.exits.byReason.map((r) => [r.label, r.value]),
  };
}

function losses(context: Context): SheetModel {
  const all = [
    ...context.report.exits.productLosses.map((l) => ({ ...l, kind: 'Vela' })),
    ...context.report.exits.supplyLosses.map((l) => ({ ...l, kind: 'Insumo' })),
  ].sort((a, b) => a.movement.occurredAt.localeCompare(b.movement.occurredAt));
  return {
    name: 'Perdas e brindes',
    columns: [
      { header: 'Data', kind: 'datetime', width: 17 },
      { header: 'Tipo', kind: 'text', width: 8 },
      { header: 'Item', kind: 'text', width: 38 },
      { header: 'Quantidade', kind: 'number', width: 12 },
      { header: 'Unidade', kind: 'text', width: 9 },
      { header: 'Motivo', kind: 'text', width: 18 },
      { header: 'Custo estimado', kind: 'money', width: 15 },
    ],
    rows: all.map((l) => [
      at(l.movement),
      l.kind,
      l.label,
      l.units,
      l.unit,
      l.reason,
      reais(l.costCents),
    ]),
  };
}

function productStock(context: Context): SheetModel {
  const products = [...context.input.products].sort(
    (a, b) => a.model.localeCompare(b.model, 'pt-BR') || a.scent.localeCompare(b.scent, 'pt-BR'),
  );
  return {
    name: 'Estoque de velas',
    columns: [
      { header: 'Recipiente', kind: 'text', width: 26 },
      { header: 'Aroma', kind: 'text', width: 20 },
      { header: 'Preço', kind: 'money', width: 12 },
      { header: 'Estoque', kind: 'integer', width: 10 },
      { header: 'Mínimo', kind: 'integer', width: 10 },
      { header: 'Situação', kind: 'text', width: 13 },
    ],
    rows: products.map((p) => [
      p.model,
      p.scent,
      reais(p.priceCents),
      p.quantity,
      p.minQuantity,
      !p.active ? 'Inativa' : p.quantity === 0 ? 'Zerado' : isLowStock(p) ? 'Estoque baixo' : 'OK',
    ]),
  };
}

function supplyStock(context: Context): SheetModel {
  const supplies = [...context.input.supplies].sort(
    (a, b) =>
      supplyCategory(a.name).localeCompare(supplyCategory(b.name), 'pt-BR') ||
      a.name.localeCompare(b.name, 'pt-BR'),
  );
  return {
    name: 'Estoque de insumos',
    columns: [
      { header: 'Insumo', kind: 'text', width: 30 },
      { header: 'Categoria', kind: 'text', width: 12 },
      { header: 'Estoque', kind: 'number', width: 11 },
      { header: 'Unidade', kind: 'text', width: 9 },
      { header: 'Mínimo', kind: 'number', width: 10 },
      { header: 'Situação', kind: 'text', width: 18 },
      { header: 'Custo médio', kind: 'text', width: 20 },
    ],
    rows: supplies.map((s) => {
      const unitCost = context.unitCosts.get(s.id);
      return [
        s.name,
        supplyCategory(s.name),
        s.quantity,
        s.unit,
        s.minQuantity,
        isLowStock(s) ? 'Abaixo do mínimo' : 'OK',
        unitCost === undefined ? 'sem custo' : formatUnitCost(unitCost, 1, s.unit),
      ];
    }),
  };
}

const MOVEMENT_TYPE: Record<Movement['type'], string> = {
  sale: 'Venda',
  production: 'Produção',
  supply_purchase: 'Entrada de insumo',
  adjustment: 'Ajuste',
};

function movements(context: Context): SheetModel {
  return {
    name: 'Lançamentos',
    columns: [
      { header: 'Data', kind: 'datetime', width: 17 },
      { header: 'Tipo', kind: 'text', width: 18 },
      { header: 'Item', kind: 'text', width: 40 },
      { header: 'Quantidade', kind: 'number', width: 12 },
      { header: 'Unidade', kind: 'text', width: 9 },
      { header: 'Valor', kind: 'money', width: 13 },
      { header: 'Observação', kind: 'text', width: 30 },
    ],
    rows: chronological(context.report.movements).map((m) => {
      if (m.productId) {
        const { model, scent } = productNames(context, m.productId);
        return [
          at(m),
          MOVEMENT_TYPE[m.type],
          `${scent} · ${model}`,
          m.quantity,
          'un.',
          reais(m.totalCents),
          m.note ?? '',
        ];
      }
      const { name, unit } = supplyInfo(context, m.supplyId);
      return [
        at(m),
        MOVEMENT_TYPE[m.type],
        name,
        m.quantity,
        unit,
        reais(m.totalCents),
        m.note ?? '',
      ];
    }),
  };
}

const SHEET_BUILDERS: Record<SheetId, (context: Context) => SheetModel> = {
  summary,
  sales,
  byProduct,
  production,
  suppliesUsed,
  purchases,
  spendingBySupply,
  exitsByReason,
  losses,
  productStock,
  supplyStock,
  movements,
};
