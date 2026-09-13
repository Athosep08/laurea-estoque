import { useState } from 'react';
import type { ReactNode } from 'react';
import type { DailyPoint, PeriodChoice, Ranked } from '../../../domain/reports';
import { percentChange } from '../../../domain/reports';
import { formatBRL } from '../../../domain/money';

// ---------------------------------------------------------------------------
// Período
// ---------------------------------------------------------------------------

const PRESETS: { choice: PeriodChoice; label: string }[] = [
  { choice: { kind: 'this-month' }, label: 'Este mês' },
  { choice: { kind: 'last-month' }, label: 'Mês passado' },
  { choice: { kind: 'last-7' }, label: '7 dias' },
  { choice: { kind: 'last-30' }, label: '30 dias' },
];

const toMonthInput = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

type PeriodPickerProps = {
  choice: PeriodChoice;
  label: string;
  now: Date;
  onChange: (choice: PeriodChoice) => void;
};

/** Botões de período + "Outro mês", que abre o seletor de mês do aparelho. */
export function PeriodPicker({ choice, label, now, onChange }: PeriodPickerProps) {
  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${
      active ? 'border-ink bg-ink text-paper' : 'border-taupe/30 bg-paper text-taupe hover:text-ink'
    }`;
  const monthValue =
    choice.kind === 'month'
      ? toMonthInput(choice.year, choice.month)
      : toMonthInput(now.getFullYear(), now.getMonth() + 1);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        role="group"
        aria-label="Período"
      >
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            aria-pressed={choice.kind === preset.choice.kind}
            onClick={() => onChange(preset.choice)}
            className={chip(choice.kind === preset.choice.kind)}
          >
            {preset.label}
          </button>
        ))}
        <label className={`${chip(choice.kind === 'month')} flex items-center gap-2`}>
          <span>Outro mês</span>
          <input
            type="month"
            aria-label="Escolher mês"
            value={monthValue}
            max={toMonthInput(now.getFullYear(), now.getMonth() + 1)}
            onChange={(e) => {
              const [year, month] = e.target.value.split('-').map(Number);
              if (year && month) onChange({ kind: 'month', year, month });
            }}
            className="w-40 bg-transparent text-sm font-normal outline-none"
          />
        </label>
      </div>
      <p className="text-xs text-taupe">{label} · comparado ao período anterior do mesmo tamanho</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

/** "▲ 12% vs anterior", verde quando a mudança é boa. Gasto subindo é ruim. */
export function Delta({
  current,
  previous,
  upIsGood = true,
}: {
  current: number;
  previous: number;
  upIsGood?: boolean;
}) {
  const change = percentChange(current, previous);
  if (change === undefined) {
    return <span className="text-xs text-taupe">sem período anterior para comparar</span>;
  }
  if (change === 0) {
    return (
      <span className="text-xs text-taupe">
        {current === previous ? 'igual ao período anterior' : 'praticamente igual ao anterior'}
      </span>
    );
  }
  const good = change > 0 === upIsGood;
  return (
    <span className={`text-xs font-medium ${good ? 'text-ok' : 'text-alert'}`}>
      {change > 0 ? '▲' : '▼'} {Math.abs(change)}% vs anterior
    </span>
  );
}

export function Kpi({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-taupe/20 bg-paper p-3">
      <span className="text-xs text-taupe">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      {children}
    </div>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">{children}</div>;
}

// ---------------------------------------------------------------------------
// Blocos e barras
// ---------------------------------------------------------------------------

export function Block({
  title,
  hint,
  wide,
  children,
}: {
  title: string;
  hint?: string;
  /** Ocupa as duas colunas no desktop. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex flex-col gap-3 rounded-xl border border-taupe/20 bg-paper p-4 ${wide ? 'lg:col-span-2' : ''}`}
    >
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="font-sans text-sm font-semibold">{title}</h2>
        {hint && <span className="text-xs text-taupe">{hint}</span>}
      </header>
      {children}
    </section>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-xs text-taupe">{children}</p>;
}

export function Warn({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-alert/10 px-3 py-2 text-sm text-alert">{children}</p>;
}

type BarsProps = {
  items: Ranked[];
  format: (value: number) => string;
  /** Com `onSelect`, cada barra vira um botão que filtra o resto do relatório. */
  selected?: string;
  onSelect?: (key: string) => void;
  empty?: string;
};

export function Bars({ items, format, selected, onSelect, empty = 'Nada no período.' }: BarsProps) {
  if (items.length === 0 || items.every((i) => i.value === 0)) return <Note>{empty}</Note>;
  const max = Math.max(...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => {
        const dimmed = selected !== undefined && selected !== item.key;
        const content = (
          <>
            <span className={`text-sm ${selected === item.key ? 'font-semibold' : ''}`}>
              {item.label}
            </span>
            <span className="text-right text-sm font-semibold tabular-nums">
              {format(item.value)}
            </span>
            <span className="col-span-2 h-2 rounded-r bg-transparent">
              <span
                className={`block h-2 rounded-r ${dimmed ? 'bg-taupe/25' : 'bg-gold'}`}
                style={{ width: `${item.value > 0 ? Math.max(2, (item.value / max) * 100) : 0}%` }}
              />
            </span>
          </>
        );
        return (
          <li key={item.key}>
            {onSelect ? (
              <button
                type="button"
                aria-pressed={selected === item.key}
                onClick={() => onSelect(item.key)}
                className="-m-1 grid w-[calc(100%+0.5rem)] grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1 rounded-md p-1 text-left hover:bg-cream"
              >
                {content}
              </button>
            ) : (
              <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1">
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Linha de lista: texto à esquerda, valor à direita, detalhe embaixo. */
export function Line({
  left,
  right,
  detail,
}: {
  left: ReactNode;
  right: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-3 border-t border-taupe/15 py-2.5 text-sm first:border-t-0 first:pt-0">
      <span>{left}</span>
      <span className="text-right font-semibold tabular-nums">{right}</span>
      {detail && <span className="col-span-2 text-xs text-taupe">{detail}</span>}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Faturamento por dia
// ---------------------------------------------------------------------------

const shortDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const dayLabel = (date: Date) => shortDate.format(date).replace(/\./g, '');

/** Arredonda o topo do eixo para um número redondo: 1, 2, 5 ou 10 × potência de 10. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const n = value / power;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * power;
}

const compactBRL = (cents: number) => formatBRL(cents).replace(/,00$/, '');

/**
 * Colunas de faturamento por dia. Passar o mouse, tocar ou focar pelo teclado
 * numa coluna mostra o valor do dia. O maior dia vem destacado, e a mesma
 * informação existe em tabela logo abaixo, para quem não enxerga o gráfico.
 */
export function DailyRevenueChart({ days }: { days: DailyPoint[] }) {
  const [active, setActive] = useState<number | undefined>();
  if (days.length === 0) return null;
  const max = niceMax(Math.max(...days.map((d) => d.revenueCents)));
  const peak = days.reduce(
    (best, d, i) => (d.revenueCents > days[best].revenueCents ? i : best),
    0,
  );
  const hasSales = days.some((d) => d.revenueCents > 0);
  const shown = active ?? (hasSales ? peak : undefined);
  const middle = Math.floor((days.length - 1) / 2);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative pt-6">
        <span className="absolute left-0 top-0 text-[11px] text-taupe">{compactBRL(max)}</span>
        <div className="pointer-events-none absolute inset-x-0 top-6 border-t border-taupe/20" />
        {shown !== undefined && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] text-paper"
            style={{
              left: `clamp(3.5rem, ${((shown + 0.5) / days.length) * 100}%, calc(100% - 3.5rem))`,
            }}
            role="status"
          >
            <b className="font-semibold">{formatBRL(days[shown].revenueCents)}</b> ·{' '}
            {days[shown].units} {days[shown].units === 1 ? 'vela' : 'velas'} ·{' '}
            {dayLabel(days[shown].date)}
          </div>
        )}
        <div
          className="flex h-32 items-end gap-[2px] border-b border-taupe/20"
          onPointerLeave={() => setActive(undefined)}
        >
          {days.map((day, index) => (
            <button
              key={day.date.toISOString()}
              type="button"
              aria-label={`${dayLabel(day.date)}: ${formatBRL(day.revenueCents)}, ${day.units} ${day.units === 1 ? 'vela' : 'velas'}`}
              onPointerEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onClick={() => setActive(index)}
              className="flex h-full flex-1 items-end justify-center rounded-sm outline-offset-1"
            >
              <span
                className={`block w-full max-w-6 rounded-t-sm ${index === shown ? 'bg-[#7E5719]' : 'bg-gold'}`}
                style={{ height: `${(day.revenueCents / max) * 100}%` }}
              />
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-taupe">
          <span>{dayLabel(days[0].date)}</span>
          {days.length > 2 && <span>{dayLabel(days[middle].date)}</span>}
          <span>{dayLabel(days[days.length - 1].date)}</span>
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-taupe">Ver os dias em tabela</summary>
        <table className="mt-2 w-full text-xs tabular-nums">
          <tbody>
            {days.filter((d) => d.revenueCents > 0).length === 0 ? (
              <tr>
                <td className="py-1 text-taupe">Nenhuma venda no período.</td>
              </tr>
            ) : (
              days
                .filter((d) => d.revenueCents > 0)
                .map((d) => (
                  <tr key={d.date.toISOString()} className="border-b border-taupe/15">
                    <td className="py-1">{dayLabel(d.date)}</td>
                    <td className="py-1">
                      {d.units} {d.units === 1 ? 'vela' : 'velas'}
                    </td>
                    <td className="py-1 text-right">{formatBRL(d.revenueCents)}</td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </details>
    </div>
  );
}
