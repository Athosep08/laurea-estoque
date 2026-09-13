import { describe, expect, it } from 'vitest';
import {
  formatDay,
  groupDaily,
  isWholeMonth,
  parseDay,
  periodLabel,
  periodRange,
  previousPeriod,
  type DailyPoint,
} from '../reports';

// 13/09/2026 às 15h, no fuso local.
const NOW = new Date(2026, 8, 13, 15, 0);
const ymd = (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()];
const range = (from: string, to: string) => ({ kind: 'range' as const, from, to });

describe('intervalo personalizado (De / Até)', () => {
  it('lê a data no fuso local, e não em UTC', () => {
    expect(ymd(parseDay('2026-09-05'))).toEqual([2026, 9, 5]);
    expect(parseDay('2026-09-05').getHours()).toBe(0);
    expect(formatDay(new Date(2026, 0, 7))).toBe('2026-01-07');
  });

  it('inclui o dia final inteiro', () => {
    const { start, end } = periodRange(range('2026-09-05', '2026-09-20'), NOW);
    expect(ymd(start)).toEqual([2026, 9, 5]);
    expect(ymd(end)).toEqual([2026, 9, 21]);
  });

  it('um dia só é um intervalo de um dia', () => {
    const { start, end } = periodRange(range('2026-09-10', '2026-09-10'), NOW);
    expect(ymd(start)).toEqual([2026, 9, 10]);
    expect(ymd(end)).toEqual([2026, 9, 11]);
  });

  it('datas trocadas (Até antes do De) valem como o mesmo intervalo', () => {
    expect(periodRange(range('2026-09-20', '2026-09-05'), NOW)).toEqual(
      periodRange(range('2026-09-05', '2026-09-20'), NOW),
    );
  });

  it('compara com os mesmos tantos dias imediatamente antes', () => {
    // 5 a 20 de set = 16 dias → 20 de ago a 4 de set
    const { start, end } = previousPeriod(range('2026-09-05', '2026-09-20'), NOW);
    expect(ymd(start)).toEqual([2026, 8, 20]);
    expect(ymd(end)).toEqual([2026, 9, 5]);
  });

  it('um mês inteiro compara com o mês anterior inteiro, mesmo com tamanhos diferentes', () => {
    // março (31 dias) compara com fevereiro (28), e não com 31 dias antes
    const { start, end } = previousPeriod(range('2026-03-01', '2026-03-31'), NOW);
    expect(ymd(start)).toEqual([2026, 2, 1]);
    expect(ymd(end)).toEqual([2026, 3, 1]);
  });

  it('reconhece quando o intervalo é um mês inteiro', () => {
    expect(isWholeMonth(periodRange(range('2026-02-01', '2026-02-28'), NOW))).toBe(true);
    expect(isWholeMonth(periodRange(range('2026-02-01', '2026-02-27'), NOW))).toBe(false);
    expect(isWholeMonth(periodRange({ kind: 'last-month' }, NOW))).toBe(true);
  });

  it('dá nome ao intervalo, com o ano só quando precisa', () => {
    expect(periodLabel(range('2026-09-05', '2026-09-20'), NOW)).toBe('5 a 20 de set');
    expect(periodLabel(range('2026-08-15', '2026-09-10'), NOW)).toBe('15 de ago a 10 de set');
    expect(periodLabel(range('2026-07-01', '2026-07-31'), NOW)).toBe('julho de 2026');
    expect(periodLabel(range('2026-09-10', '2026-09-10'), NOW)).toBe('10 de set');
    expect(periodLabel(range('2025-12-20', '2026-01-10'), NOW)).toBe(
      '20 de dez de 2025 a 10 de jan de 2026',
    );
    expect(periodLabel(range('2025-03-02', '2025-03-09'), NOW)).toBe(
      '2 de mar de 2025 a 9 de mar de 2025',
    );
  });
});

describe('agrupamento do gráfico', () => {
  const days = (count: number, start = new Date(2026, 0, 1)): DailyPoint[] =>
    Array.from({ length: count }, (_, i) => ({
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
      revenueCents: 1000,
      units: 1,
    }));

  it('até 62 dias, uma coluna por dia', () => {
    const { granularity, buckets } = groupDaily(days(62));
    expect(granularity).toBe('day');
    expect(buckets).toHaveLength(62);
  });

  it('até um ano, de 7 em 7 dias, com a última semana terminando junto com o período', () => {
    const { granularity, buckets } = groupDaily(days(90));
    expect(granularity).toBe('week');
    expect(buckets).toHaveLength(13); // 12 semanas + 6 dias
    expect(buckets[0]).toMatchObject({ revenueCents: 7000, units: 7 });
    expect(buckets[12]).toMatchObject({ revenueCents: 6000, units: 6 });
    expect(ymd(buckets[12].end)).toEqual([2026, 4, 1]); // dia seguinte ao último (31/03)
  });

  it('acima de um ano, por mês do calendário', () => {
    const { granularity, buckets } = groupDaily(days(400, new Date(2025, 0, 15)));
    expect(granularity).toBe('month');
    expect(ymd(buckets[0].start)).toEqual([2025, 1, 15]);
    expect(buckets[0].units).toBe(17); // 15 a 31 de janeiro
    expect(ymd(buckets[1].start)).toEqual([2025, 2, 1]);
    expect(buckets.reduce((t, b) => t + b.units, 0)).toBe(400);
  });

  it('não soma nem perde nada ao agrupar', () => {
    const { buckets } = groupDaily(days(200));
    expect(buckets.reduce((t, b) => t + b.revenueCents, 0)).toBe(200 * 1000);
  });
});
