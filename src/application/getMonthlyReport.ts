import { getMonthlyReport as computeMonthlyReport, type MonthlyReport } from '../domain/report';
import type { EstoqueRepository } from '../infra/storage/EstoqueRepository';

export function getMonthlyReport(
  repository: EstoqueRepository,
  year: number,
  month: number,
): MonthlyReport {
  return computeMonthlyReport(year, month, repository.listMovements(), repository.listProducts());
}
