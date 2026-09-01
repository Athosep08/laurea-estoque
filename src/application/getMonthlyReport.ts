import { getMonthlyReport as computeMonthlyReport, type MonthlyReport } from '../domain/report';
import type { EstoqueRepository } from '../infra/storage/EstoqueRepository';

export async function getMonthlyReport(
  repository: EstoqueRepository,
  year: number,
  month: number,
): Promise<MonthlyReport> {
  const [movements, products] = await Promise.all([
    repository.listMovements(),
    repository.listProducts(),
  ]);
  return computeMonthlyReport(year, month, movements, products);
}
