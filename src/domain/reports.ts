import type { Cents, Movement, Product, Recipe, Supply, UUID } from './models';
import { roundQuantity } from './quantity';

/**
 * Relatórios por período: Visão geral, Vendas, Produção, Saídas de estoque e
 * Gastos. Tudo aqui é função pura — a "data de hoje" chega por parâmetro
 * (`now`), nunca por `new Date()` direto, então o resultado não depende do
 * relógio da máquina e os testes são determinísticos.
 *
 * Datas são tratadas no fuso do aparelho: "este mês" é o mês do calendário
 * de quem está usando, não o mês em UTC (uma venda às 22h do dia 31 em
 * Chapecó ainda é do mês 31, mesmo sendo dia 1º em UTC).
 */

// ---------------------------------------------------------------------------
// Período
// ---------------------------------------------------------------------------

export type PeriodChoice =
  | { kind: 'this-month' }
  | { kind: 'last-month' }
  | { kind: 'last-7' }
  | { kind: 'last-30' }
  /** `month` é 1-12. */
  | { kind: 'month'; year: number; month: number };

/** Intervalo [start, end): inclui `start`, exclui `end`. */
export type Period = { start: Date; end: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const firstOfMonth = (year: number, monthIndex: number) => new Date(year, monthIndex, 1);

export function periodRange(choice: PeriodChoice, now: Date): Period {
  const tomorrow = addDays(startOfDay(now), 1);
  switch (choice.kind) {
    case 'this-month':
      return { start: firstOfMonth(now.getFullYear(), now.getMonth()), end: tomorrow };
    case 'last-month':
      return {
        start: firstOfMonth(now.getFullYear(), now.getMonth() - 1),
        end: firstOfMonth(now.getFullYear(), now.getMonth()),
      };
    case 'last-7':
      return { start: addDays(tomorrow, -7), end: tomorrow };
    case 'last-30':
      return { start: addDays(tomorrow, -30), end: tomorrow };
    case 'month':
      return {
        start: firstOfMonth(choice.year, choice.month - 1),
        end: firstOfMonth(choice.year, choice.month),
      };
  }
}

/**
 * O período anterior do mesmo tamanho, para comparar. "Este mês" até o dia
 * 13 compara com o dia 1º a 13 do mês passado — e não com o mês passado
 * inteiro, que teria mais dias e sempre pareceria melhor.
 */
export function previousPeriod(choice: PeriodChoice, now: Date): Period {
  const current = periodRange(choice, now);
  if (choice.kind === 'this-month') {
    const start = firstOfMonth(now.getFullYear(), now.getMonth() - 1);
    const days = Math.round((current.end.getTime() - current.start.getTime()) / DAY_MS);
    const end = addDays(start, days);
    const cap = firstOfMonth(now.getFullYear(), now.getMonth());
    return { start, end: end > cap ? cap : end };
  }
  if (choice.kind === 'last-month' || choice.kind === 'month') {
    const start = current.start;
    return { start: firstOfMonth(start.getFullYear(), start.getMonth() - 1), end: start };
  }
  const days = choice.kind === 'last-7' ? 7 : 30;
  return { start: addDays(current.start, -days), end: current.start };
}

const monthYear = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const dayMonth = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const clean = (text: string) => text.replace(/\./g, '');

/** "1 a 13 de set", "agosto de 2026", "15 de ago a 13 de set". */
export function periodLabel(choice: PeriodChoice, now: Date): string {
  const { start, end } = periodRange(choice, now);
  if (choice.kind === 'last-month' || choice.kind === 'month') return monthYear.format(start);
  const last = addDays(end, -1);
  const sameMonth = start.getMonth() === last.getMonth();
  const from = sameMonth ? String(start.getDate()) : clean(dayMonth.format(start));
  return `${from} a ${clean(dayMonth.format(last))}`;
}

export function isInPeriod(movement: Movement, period: Period): boolean {
  const at = new Date(movement.occurredAt).getTime();
  return at >= period.start.getTime() && at < period.end.getTime();
}

/** Variação percentual inteira; `undefined` quando não há base para comparar. */
export function percentChange(current: number, previous: number): number | undefined {
  if (previous === 0) return undefined;
  return Math.round(((current - previous) / previous) * 100);
}

// ---------------------------------------------------------------------------
// Categorias e custos
// ---------------------------------------------------------------------------

export const SUPPLY_CATEGORIES = [
  'Cera',
  'Essências',
  'Frascos',
  'Montagem',
  'Embalagem',
  'Outros',
] as const;
export type SupplyCategory = (typeof SUPPLY_CATEGORIES)[number];

const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * O cadastro de insumo não tem categoria; ela é deduzida do nome. Embalagem
 * é testada antes de Montagem porque "Adesivo da sacola" é embalagem, e
 * "Adesivo da vela" é montagem.
 */
export function supplyCategory(name: string): SupplyCategory {
  const text = plain(name);
  if (text.startsWith('cera')) return 'Cera';
  if (text.startsWith('essencia')) return 'Essências';
  if (text.startsWith('frasco')) return 'Frascos';
  if (/sacola|caixa|embalagem|fita|laco|papel/.test(text)) return 'Embalagem';
  if (/pavio|ilhos|adesivo|tampa|rotulo/.test(text)) return 'Montagem';
  return 'Outros';
}

/**
 * Custo de cada insumo, em centavos por unidade do insumo (por grama, por
 * unidade...): média ponderada de todas as entradas com valor pago, de todo
 * o histórico. Insumo sem nenhuma compra com valor fica de fora — o custo
 * dele é desconhecido, e quem usa o mapa precisa dizer isso, não inventar.
 */
export function supplyUnitCosts(movements: Movement[]): Map<UUID, number> {
  const totals = new Map<UUID, { cents: number; quantity: number }>();
  for (const movement of movements) {
    if (movement.undone || movement.type !== 'supply_purchase') continue;
    if (!movement.supplyId || movement.totalCents === undefined || !(movement.quantity > 0)) {
      continue;
    }
    const entry = totals.get(movement.supplyId) ?? { cents: 0, quantity: 0 };
    entry.cents += movement.totalCents;
    entry.quantity += movement.quantity;
    totals.set(movement.supplyId, entry);
  }
  return new Map([...totals].map(([id, { cents, quantity }]) => [id, cents / quantity]));
}

export type CostEstimate = { cents: Cents; missing: UUID[] };

/** Custo de uma vela pela ficha técnica. `missing` lista insumos sem custo conhecido. */
export function recipeCost(recipe: Recipe, unitCosts: Map<UUID, number>): CostEstimate {
  let cents = 0;
  const missing: UUID[] = [];
  for (const item of recipe.items) {
    const cost = unitCosts.get(item.supplyId);
    if (cost === undefined) missing.push(item.supplyId);
    else cents += cost * item.quantityPerUnit;
  }
  return { cents: Math.round(cents), missing };
}

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------

export type Ranked = { key: string; label: string; value: number };
export type DailyPoint = { date: Date; revenueCents: Cents; units: number };

export type SupplyUse = {
  supplyId: UUID;
  name: string;
  unit: string;
  quantity: number;
  /** Ausente quando o insumo ainda não tem custo conhecido. */
  costCents?: Cents;
};

export type ModelMargin = {
  model: string;
  priceCents: Cents;
  /** Média entre os aromas com custo completo. Ausente se nenhum tiver. */
  costCents?: Cents;
  aromasWithCost: number;
  aromas: number;
  /** Insumos que faltam para calcular o custo de algum aroma. */
  missingSupplies: string[];
};

export type SpendingRow = {
  supplyId: UUID;
  name: string;
  unit: string;
  category: SupplyCategory;
  purchases: number;
  quantity: number;
  totalCents: Cents;
};

export type ReasonLoss = {
  movement: Movement;
  label: string;
  reason: string;
  /** Quantidade que saiu, na unidade do item (`unit`). */
  units: number;
  unit: string;
  costCents?: Cents;
};

export type Report = {
  /** Lançamentos do período, sem os desfeitos, mais recentes primeiro. */
  movements: Movement[];
  sales: {
    list: Movement[];
    revenueCents: Cents;
    units: number;
    count: number;
    ticketCents: Cents;
    discountCents: Cents;
    discountedCount: number;
    byModel: Ranked[];
    byScent: Ranked[];
    daily: DailyPoint[];
  };
  production: {
    list: Movement[];
    units: number;
    byModel: Ranked[];
    byScent: Ranked[];
    suppliesUsed: SupplyUse[];
    costCents: Cents;
    /** Falso quando algum insumo usado não tem custo conhecido. */
    costComplete: boolean;
  };
  exits: {
    soldUnits: number;
    byReason: Ranked[];
    productLosses: ReasonLoss[];
    supplyLosses: ReasonLoss[];
    suppliesUsedCents: Cents;
    supplyLossCents: Cents;
    productLossCents: Cents;
    valueComplete: boolean;
  };
  spending: {
    totalCents: Cents;
    unpricedCount: number;
    byCategory: Ranked[];
    bySupply: SpendingRow[];
  };
  margins: ModelMargin[];
};

export type ReportInput = {
  products: Product[];
  supplies: Supply[];
  recipes: Recipe[];
  /** Todos os lançamentos: o custo dos insumos vem do histórico inteiro. */
  movements: Movement[];
};

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function rank(entries: Map<string, number>, labels?: Map<string, string>): Ranked[] {
  return [...entries]
    .map(([key, value]) => ({ key, label: labels?.get(key) ?? key, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'pt-BR'));
}

function add(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

/** Motivo de ajuste agrupável: sem espaços sobrando e com a 1ª letra maiúscula. */
export function adjustmentReason(note: string | undefined): string {
  const text = (note ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return 'Sem motivo';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildReport(input: ReportInput, period: Period): Report {
  const { products, supplies, recipes } = input;
  const productById = new Map(products.map((p) => [p.id, p]));
  const supplyById = new Map(supplies.map((s) => [s.id, s]));
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const unitCosts = supplyUnitCosts(input.movements);

  const movements = input.movements
    .filter((m) => !m.undone && isInPeriod(m, period))
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const modelNames = [...new Set(products.map((p) => p.model))];
  const modelOf = (m: Movement) => productById.get(m.productId ?? '')?.model ?? 'Vela removida';
  const scentOf = (m: Movement) => productById.get(m.productId ?? '')?.scent ?? 'Vela removida';
  const zeroByModel = () => new Map(modelNames.map((name) => [name, 0]));

  const productCost = (productId: UUID | undefined): CostEstimate | undefined => {
    const recipe = recipeById.get(productById.get(productId ?? '')?.recipeId ?? '');
    return recipe ? recipeCost(recipe, unitCosts) : undefined;
  };

  // --- Vendas ---
  const saleList = movements.filter((m) => m.type === 'sale');
  const salesByModel = zeroByModel();
  const salesByScent = new Map<string, number>();
  let discountCents = 0;
  let discountedCount = 0;
  for (const sale of saleList) {
    const total = sale.totalCents ?? 0;
    add(salesByModel, modelOf(sale), total);
    add(salesByScent, scentOf(sale), sale.quantity);
    const product = productById.get(sale.productId ?? '');
    if (product) {
      const gap = product.priceCents * sale.quantity - total;
      if (gap > 0) {
        discountCents += gap;
        discountedCount += 1;
      }
    }
  }
  const revenueCents = sum(saleList.map((s) => s.totalCents ?? 0));

  const daily: DailyPoint[] = [];
  for (let day = startOfDay(period.start); day < period.end; day = addDays(day, 1)) {
    const next = addDays(day, 1);
    const ofDay = saleList.filter((s) => {
      const at = new Date(s.occurredAt);
      return at >= day && at < next;
    });
    daily.push({
      date: day,
      revenueCents: sum(ofDay.map((s) => s.totalCents ?? 0)),
      units: sum(ofDay.map((s) => s.quantity)),
    });
  }

  // --- Produção ---
  const productionList = movements.filter((m) => m.type === 'production');
  const producedByModel = zeroByModel();
  const producedByScent = new Map<string, number>();
  const used = new Map<UUID, number>();
  for (const production of productionList) {
    add(producedByModel, modelOf(production), production.quantity);
    add(producedByScent, scentOf(production), production.quantity);
    for (const consumed of production.consumed ?? []) {
      used.set(
        consumed.supplyId,
        roundQuantity((used.get(consumed.supplyId) ?? 0) + consumed.quantity),
      );
    }
  }
  const suppliesUsed: SupplyUse[] = [...used].map(([supplyId, quantity]) => {
    const supply = supplyById.get(supplyId);
    const unitCost = unitCosts.get(supplyId);
    return {
      supplyId,
      name: supply?.name ?? 'Insumo removido',
      unit: supply?.unit ?? '',
      quantity,
      costCents: unitCost === undefined ? undefined : Math.round(unitCost * quantity),
    };
  });
  suppliesUsed.sort(
    (a, b) => (b.costCents ?? -1) - (a.costCents ?? -1) || a.name.localeCompare(b.name, 'pt-BR'),
  );
  const productionCost = sum(suppliesUsed.map((u) => u.costCents ?? 0));
  const productionCostComplete = suppliesUsed.every((u) => u.costCents !== undefined);

  // --- Saídas de estoque ---
  const byReason = new Map<string, number>();
  const soldUnits = sum(saleList.map((s) => s.quantity));
  if (soldUnits > 0) byReason.set('Vendidas', soldUnits);
  const productLosses: ReasonLoss[] = [];
  const supplyLosses: ReasonLoss[] = [];
  let valueComplete = productionCostComplete;
  for (const movement of movements) {
    if (movement.type !== 'adjustment' || movement.quantity >= 0) continue;
    const units = -movement.quantity;
    const reason = adjustmentReason(movement.note);
    if (movement.productId) {
      add(byReason, reason, units);
      const cost = productCost(movement.productId);
      const known = cost && cost.missing.length === 0;
      if (!known) valueComplete = false;
      productLosses.push({
        movement,
        reason,
        units,
        unit: 'un.',
        label: `${scentOf(movement)} · ${modelOf(movement)}`,
        costCents: known ? cost.cents * units : undefined,
      });
    } else if (movement.supplyId) {
      const unitCost = unitCosts.get(movement.supplyId);
      if (unitCost === undefined) valueComplete = false;
      const supply = supplyById.get(movement.supplyId);
      supplyLosses.push({
        movement,
        reason,
        units,
        unit: supply?.unit ?? '',
        label: supply?.name ?? 'Insumo removido',
        costCents: unitCost === undefined ? undefined : Math.round(unitCost * units),
      });
    }
  }

  // --- Gastos ---
  const purchases = movements.filter((m) => m.type === 'supply_purchase');
  const priced = purchases.filter((m) => m.totalCents !== undefined);
  const spendingBySupply = new Map<UUID, SpendingRow>();
  const byCategory = new Map<string, number>();
  for (const purchase of priced) {
    const supplyId = purchase.supplyId ?? '';
    const supply = supplyById.get(supplyId);
    const name = supply?.name ?? 'Insumo removido';
    const category = supplyCategory(name);
    const row = spendingBySupply.get(supplyId) ?? {
      supplyId,
      name,
      unit: supply?.unit ?? '',
      category,
      purchases: 0,
      quantity: 0,
      totalCents: 0,
    };
    row.purchases += 1;
    row.quantity = roundQuantity(row.quantity + purchase.quantity);
    row.totalCents += purchase.totalCents ?? 0;
    spendingBySupply.set(supplyId, row);
    add(byCategory, category, purchase.totalCents ?? 0);
  }

  // --- Margem por recipiente (preço × custo pela ficha técnica) ---
  const margins: ModelMargin[] = modelNames.map((model) => {
    const ofModel = products.filter((p) => p.model === model);
    const costs = ofModel.map((p) => productCost(p.id));
    const complete = costs.filter((c): c is CostEstimate => !!c && c.missing.length === 0);
    const missing = new Set(
      costs.flatMap((c) => c?.missing ?? []).map((id) => supplyById.get(id)?.name ?? id),
    );
    return {
      model,
      priceCents: Math.min(...ofModel.map((p) => p.priceCents)),
      costCents: complete.length
        ? Math.round(sum(complete.map((c) => c.cents)) / complete.length)
        : undefined,
      aromasWithCost: complete.length,
      aromas: ofModel.length,
      missingSupplies: [...missing].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    };
  });
  margins.sort((a, b) => a.priceCents - b.priceCents || a.model.localeCompare(b.model));

  return {
    movements,
    sales: {
      list: saleList,
      revenueCents,
      units: soldUnits,
      count: saleList.length,
      ticketCents: saleList.length ? Math.round(revenueCents / saleList.length) : 0,
      discountCents,
      discountedCount,
      byModel: rank(salesByModel),
      byScent: rank(salesByScent),
      daily,
    },
    production: {
      list: productionList,
      units: sum(productionList.map((p) => p.quantity)),
      byModel: rank(producedByModel),
      byScent: rank(producedByScent),
      suppliesUsed,
      costCents: productionCost,
      costComplete: productionCostComplete,
    },
    exits: {
      soldUnits,
      byReason: rank(byReason),
      productLosses,
      supplyLosses,
      suppliesUsedCents: productionCost,
      supplyLossCents: sum(supplyLosses.map((l) => l.costCents ?? 0)),
      productLossCents: sum(productLosses.map((l) => l.costCents ?? 0)),
      valueComplete,
    },
    spending: {
      totalCents: sum(priced.map((p) => p.totalCents ?? 0)),
      unpricedCount: purchases.length - priced.length,
      byCategory: rank(byCategory),
      bySupply: [...spendingBySupply.values()].sort(
        (a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name, 'pt-BR'),
      ),
    },
    margins,
  };
}
