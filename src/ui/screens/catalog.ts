import type { Movement, MovementType, Product, Recipe, Supply } from '../../domain/models';
import { isLowStock } from '../../domain/inventory';
import { formatBRL } from '../../domain/money';
import { formatQuantity, roundQuantity } from '../../domain/quantity';

/** Minúsculas e sem acento, para "cafe" achar "Café". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Cada palavra da busca precisa aparecer, em qualquer ordem: "lavanda fosco". */
export function matchesQuery(haystack: string, query: string): boolean {
  const target = normalize(haystack);
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => target.includes(word));
}

export const productLabel = (product: Product) => `${product.scent} ${product.model}`;

export const byScent = (a: Product, b: Product) => a.scent.localeCompare(b.scent, 'pt-BR');
export const byName = (a: Supply, b: Supply) => a.name.localeCompare(b.name, 'pt-BR');

/** Estoque baixo primeiro, depois por aroma. Usado na consulta de estoque. */
export function lowStockFirst(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    const lowA = isLowStock(a);
    const lowB = isLowStock(b);
    if (lowA !== lowB) return lowA ? -1 : 1;
    return byScent(a, b);
  });
}

export type ModelSummary = {
  model: string;
  count: number;
  units: number;
  lowCount: number;
  minPriceCents: number;
  maxPriceCents: number;
};

/** Um resumo por recipiente, do mais barato para o mais caro (90g primeiro). */
export function summarizeModels(products: Product[]): ModelSummary[] {
  const byModel = new Map<string, ModelSummary>();
  for (const product of products) {
    const summary = byModel.get(product.model) ?? {
      model: product.model,
      count: 0,
      units: 0,
      lowCount: 0,
      minPriceCents: product.priceCents,
      maxPriceCents: product.priceCents,
    };
    summary.count += 1;
    summary.units += product.quantity;
    if (isLowStock(product)) summary.lowCount += 1;
    summary.minPriceCents = Math.min(summary.minPriceCents, product.priceCents);
    summary.maxPriceCents = Math.max(summary.maxPriceCents, product.priceCents);
    byModel.set(product.model, summary);
  }
  return [...byModel.values()].sort(
    (a, b) => a.minPriceCents - b.minPriceCents || a.model.localeCompare(b.model),
  );
}

export function formatModelPrice(summary: ModelSummary): string {
  return summary.minPriceCents === summary.maxPriceCents
    ? formatBRL(summary.minPriceCents)
    : `a partir de ${formatBRL(summary.minPriceCents)}`;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Insumos que faltariam para produzir `quantity` unidades de `product`. */
export function missingForProduction(
  product: Product,
  quantity: number,
  recipes: Recipe[],
  supplies: Supply[],
): Supply[] {
  const recipe = recipes.find((r) => r.id === product.recipeId);
  if (!recipe) return [];
  return recipe.items
    .map((item) => ({
      supply: supplies.find((s) => s.id === item.supplyId),
      required: roundQuantity(item.quantityPerUnit * quantity),
    }))
    .filter(({ supply, required }) => !supply || supply.quantity < required)
    .flatMap(({ supply }) => (supply ? [supply] : []));
}

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  production: 'Produção',
  sale: 'Venda',
  adjustment: 'Ajuste',
  supply_purchase: 'Entrada de insumo',
};

/** "2× Lavanda · Recipiente Fosco 200g" ou "+1.000 g · Cera de coco". */
export function describeMovement(
  movement: Movement,
  products: Product[],
  supplies: Supply[],
): string {
  if (movement.productId) {
    const product = products.find((p) => p.id === movement.productId);
    const name = product ? `${product.scent} · ${product.model}` : 'Vela removida';
    const qty =
      movement.type === 'adjustment'
        ? `${movement.quantity > 0 ? '+' : '−'}${Math.abs(movement.quantity)}`
        : `${movement.quantity}×`;
    return `${qty} ${name}`;
  }
  const supply = supplies.find((s) => s.id === movement.supplyId);
  const unit = supply ? ` ${supply.unit}` : '';
  const sign = movement.type === 'adjustment' && movement.quantity < 0 ? '−' : '+';
  return `${sign}${formatQuantity(Math.abs(movement.quantity))}${unit} · ${supply?.name ?? 'Insumo removido'}`;
}
