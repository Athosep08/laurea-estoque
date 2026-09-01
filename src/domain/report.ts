import type { Cents, Movement, Product, UUID } from './models';
import { sumCents } from './money';

export type ProductReportRow = {
  productId: UUID;
  model: string;
  scent: string;
  produced: number;
  sold: number;
  revenueCents: Cents;
  currentStock: number;
};

export type MonthlyReport = {
  year: number;
  month: number; // 1-12
  totalProduced: number;
  totalSold: number;
  totalRevenueCents: Cents;
  byProduct: ProductReportRow[];
  /** Movimentos do período, mais recentes primeiro. Desfeitos ficam de fora. */
  movements: Movement[];
};

function isInPeriod(movement: Movement, year: number, month: number): boolean {
  const date = new Date(movement.occurredAt);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month;
}

/**
 * Agrega os movimentos de um mês. Função pura: a "data de hoje" nunca entra
 * aqui — `year`/`month` são fornecidos por quem chama, então o resultado não
 * depende do relógio da máquina.
 *
 * Recebe também `products` (além de `movements`, como descrito no documento
 * de referência) porque o "estoque atual" de cada linha da quebra por produto
 * reflete o saldo vigente, não algo derivável apenas do histórico do mês.
 */
export function getMonthlyReport(
  year: number,
  month: number,
  movements: Movement[],
  products: Product[],
): MonthlyReport {
  const periodMovements = movements
    .filter((movement) => !movement.undone && isInPeriod(movement, year, month))
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const rowByProductId = new Map<UUID, ProductReportRow>(
    products.map((product) => [
      product.id,
      {
        productId: product.id,
        model: product.model,
        scent: product.scent,
        produced: 0,
        sold: 0,
        revenueCents: 0,
        currentStock: product.quantity,
      },
    ]),
  );

  let totalProduced = 0;
  let totalSold = 0;
  const saleTotals: Cents[] = [];

  for (const movement of periodMovements) {
    if (!movement.productId) continue;
    const row = rowByProductId.get(movement.productId);
    if (!row) continue;

    if (movement.type === 'production') {
      row.produced += movement.quantity;
      totalProduced += movement.quantity;
    } else if (movement.type === 'sale') {
      row.sold += movement.quantity;
      totalSold += movement.quantity;
      const revenue = movement.totalCents ?? 0;
      row.revenueCents += revenue;
      saleTotals.push(revenue);
    }
  }

  return {
    year,
    month,
    totalProduced,
    totalSold,
    totalRevenueCents: sumCents(saleTotals),
    byProduct: Array.from(rowByProductId.values()),
    movements: periodMovements,
  };
}
