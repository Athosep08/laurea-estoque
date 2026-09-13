import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Movement, Product } from '../../domain/models';
import { isLowStock } from '../../domain/inventory';
import { formatBRL, formatUnitCost } from '../../domain/money';
import { formatQuantity } from '../../domain/quantity';
import {
  buildReport,
  periodLabel,
  periodRange,
  previousPeriod,
  type PeriodChoice,
  type Report,
} from '../../domain/reports';
import {
  buildWorkbook,
  type WorkbookKind,
  type WorkbookModel,
} from '../../application/reportWorkbook';
import type { UseInventoryReturn } from '../hooks/useInventory';
import { Field, inputClassName } from '../components/Field';
import {
  Bars,
  Block,
  DailyRevenueChart,
  Delta,
  Kpi,
  KpiGrid,
  Line,
  Note,
  PeriodPicker,
  Warn,
} from '../components/report/ReportParts';
import { MOVEMENT_LABELS, describeMovement, matchesQuery, pluralize } from './catalog';

type ReportScreenProps = {
  inventory: UseInventoryReturn;
  isOnline: boolean;
  /** Gera e entrega a planilha. Vem do App, que é quem conhece o adaptador de .xlsx. */
  onExport: (model: WorkbookModel) => Promise<void>;
  /** Só para testes: fixa a "data de hoje". */
  now?: Date;
};

type View = 'home' | 'overview' | 'sales' | 'production' | 'exits' | 'spending' | 'history';

const TITLES: Record<Exclude<View, 'home'>, string> = {
  overview: 'Visão geral',
  sales: 'Vendas',
  production: 'Produção',
  exits: 'Saídas de estoque',
  spending: 'Gastos',
  history: 'Histórico de lançamentos',
};

/** O que cada tela exporta. A Visão geral exporta o relatório completo. */
const EXPORT_KIND: Record<Exclude<View, 'home'>, WorkbookKind> = {
  overview: 'complete',
  sales: 'sales',
  production: 'production',
  exits: 'exits',
  spending: 'spending',
  history: 'history',
};

const shortDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const when = (movement: Movement) =>
  shortDate.format(new Date(movement.occurredAt)).replace(/\./g, '');
const units = (n: number) => pluralize(n, 'vela', 'velas');

export function ReportScreen({ inventory, isOnline, onExport, now: fixedNow }: ReportScreenProps) {
  const { products, supplies, recipes, movements } = inventory;
  const [now] = useState(() => fixedNow ?? new Date());
  const [view, setView] = useState<View>('home');
  const [choice, setChoice] = useState<PeriodChoice>({ kind: 'this-month' });

  const { report, previous } = useMemo(() => {
    const input = { products, supplies, recipes, movements };
    return {
      report: buildReport(input, periodRange(choice, now)),
      previous: buildReport(input, previousPeriod(choice, now)),
    };
  }, [products, supplies, recipes, movements, choice, now]);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | undefined>();

  async function exportWorkbook(kind: WorkbookKind) {
    setExporting(true);
    setExportError(undefined);
    try {
      await onExport(buildWorkbook(kind, { products, supplies, recipes, movements }, choice, now));
    } catch {
      setExportError('Não foi possível gerar a planilha. Tente de novo.');
    } finally {
      setExporting(false);
    }
  }

  const picker = (
    <PeriodPicker choice={choice} label={periodLabel(choice, now)} now={now} onChange={setChoice} />
  );
  const exportNotice = exportError && <Warn>{exportError}</Warn>;

  if (view === 'home') {
    return (
      <ReportsHome
        report={report}
        picker={picker}
        onOpen={setView}
        exportButton={
          <ExportButton
            label="Baixar relatório completo (Excel)"
            busy={exporting}
            onClick={() => exportWorkbook('complete')}
            wide
          />
        }
        notice={exportNotice}
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setView('home')}
        className="-ml-2 self-start rounded-md px-2 py-1 text-sm font-medium text-taupe hover:bg-paper"
      >
        ‹ Relatórios
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{TITLES[view]}</h1>
        <ExportButton
          label={view === 'overview' ? 'Baixar relatório completo' : 'Exportar para Excel'}
          busy={exporting}
          onClick={() => exportWorkbook(EXPORT_KIND[view])}
        />
      </div>
      {exportNotice}
      {picker}
      {view === 'overview' && (
        <Overview report={report} previous={previous} inventory={inventory} />
      )}
      {view === 'sales' && <Sales report={report} previous={previous} products={products} />}
      {view === 'production' && <Production report={report} previous={previous} />}
      {view === 'exits' && <Exits report={report} />}
      {view === 'spending' && <Spending report={report} previous={previous} />}
      {view === 'history' && <History report={report} inventory={inventory} isOnline={isOnline} />}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Início dos relatórios
// ---------------------------------------------------------------------------

function ExportButton({
  label,
  busy,
  onClick,
  wide,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex items-center justify-center gap-2 rounded-lg border border-ok/40 bg-paper px-4 py-2.5 text-sm font-semibold text-ok hover:bg-ok/10 disabled:opacity-60 ${
        wide ? 'w-full' : ''
      }`}
    >
      <span aria-hidden="true">↓</span>
      {busy ? 'Gerando planilha…' : label}
    </button>
  );
}

function ReportsHome({
  report,
  picker,
  onOpen,
  exportButton,
  notice,
}: {
  report: Report;
  picker: ReactNode;
  onOpen: (view: View) => void;
  exportButton: ReactNode;
  notice: ReactNode;
}) {
  const revenue = report.sales.revenueCents;
  const spent = report.spending.totalCents;
  const outUnits = report.exits.byReason.reduce((total, r) => total + r.value, 0);
  const cards: { view: View; title: string; value: string; description: string }[] = [
    {
      view: 'sales',
      title: 'Vendas',
      value: formatBRL(revenue),
      description: 'Faturamento, aromas e recipientes que mais saem',
    },
    {
      view: 'production',
      title: 'Produção',
      value: units(report.production.units),
      description: 'O que foi feito e quanto custou',
    },
    {
      view: 'exits',
      title: 'Saídas de estoque',
      value: units(outUnits),
      description: 'Vendas, brindes, quebras e perdas',
    },
    {
      view: 'spending',
      title: 'Gastos',
      value: formatBRL(spent),
      description: 'Quanto foi gasto, e com o quê',
    },
    {
      view: 'history',
      title: 'Histórico',
      value: pluralize(report.movements.length, 'lançamento', 'lançamentos'),
      description: 'Tudo o que foi lançado, com Desfazer',
    },
  ];

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Relatórios</h1>
      {picker}
      <button
        type="button"
        onClick={() => onOpen('overview')}
        className="flex flex-col gap-3 rounded-2xl bg-ink p-4 text-left text-paper hover:bg-ink/90"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="font-display text-2xl font-semibold">Visão geral</span>
          <span className="text-xs text-paper/70">Tudo num lugar só ›</span>
        </span>
        <span className="grid grid-cols-3 gap-2">
          <Figure label="Entrou" value={formatBRL(revenue)} />
          <Figure label="Saiu" value={formatBRL(spent)} />
          <Figure label="Sobrou" value={formatBRL(revenue - spent)} />
        </span>
      </button>
      {exportButton}
      {notice}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((card) => (
          <button
            key={card.view}
            type="button"
            onClick={() => onOpen(card.view)}
            className="flex flex-col gap-1.5 rounded-xl border border-taupe/20 bg-paper p-4 text-left hover:border-gold"
          >
            <span className="text-sm font-semibold">{card.title}</span>
            <span className="text-lg font-semibold tabular-nums">{card.value}</span>
            <span className="text-xs leading-snug text-taupe">{card.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-[11px] text-paper/70">{label}</span>
      <span className="text-sm font-semibold tabular-nums sm:text-base">{value}</span>
    </span>
  );
}

function Hero({ label, cents, children }: { label: string; cents: number; children?: ReactNode }) {
  const negative = cents < 0;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-taupe">{label}</span>
      <span
        className={`text-4xl font-semibold tabular-nums tracking-tight ${negative ? 'text-alert' : ''}`}
      >
        {negative ? '−' : ''}
        {formatBRL(Math.abs(cents))}
      </span>
      {children}
    </div>
  );
}

const Grid = ({ children }: { children: ReactNode }) => (
  <div className="grid gap-4 lg:grid-cols-2">{children}</div>
);

// ---------------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------------

function Overview({
  report,
  previous,
  inventory,
}: {
  report: Report;
  previous: Report;
  inventory: UseInventoryReturn;
}) {
  const { sales, spending } = report;
  const lowProducts = inventory.products.filter((p) => p.active && isLowStock(p)).length;
  const lowSupplies = inventory.supplies.filter(isLowStock).map((s) => s.name);

  return (
    <>
      <Hero
        label="Sobrou no período (vendas menos compras de insumo)"
        cents={sales.revenueCents - spending.totalCents}
      >
        <span className="text-sm text-taupe">
          Entrou {formatBRL(sales.revenueCents)} · Saiu {formatBRL(spending.totalCents)}
        </span>
      </Hero>
      <KpiGrid>
        <Kpi label="Faturamento" value={formatBRL(sales.revenueCents)}>
          <Delta current={sales.revenueCents} previous={previous.sales.revenueCents} />
        </Kpi>
        <Kpi label="Gastos com insumo" value={formatBRL(spending.totalCents)}>
          <Delta
            current={spending.totalCents}
            previous={previous.spending.totalCents}
            upIsGood={false}
          />
        </Kpi>
        <Kpi label="Velas vendidas" value={String(sales.units)}>
          <Delta current={sales.units} previous={previous.sales.units} />
        </Kpi>
        <Kpi label="Velas produzidas" value={String(report.production.units)}>
          <Delta current={report.production.units} previous={previous.production.units} />
        </Kpi>
        <Kpi label="Ticket médio" value={formatBRL(sales.ticketCents)} />
        <Kpi label="Descontos dados" value={formatBRL(sales.discountCents)} />
      </KpiGrid>
      <Grid>
        <Block title="Faturamento por dia" hint="maior dia em destaque" wide>
          <DailyRevenueChart days={sales.daily} />
        </Block>
        <Block title="Aromas que mais venderam" hint="velas">
          <Bars
            items={sales.byScent.slice(0, 5)}
            format={String}
            empty="Nenhuma venda no período."
          />
        </Block>
        <Block title="Precisa de atenção" hint="agora">
          {lowProducts > 0 && <Warn>{units(lowProducts)} com estoque baixo</Warn>}
          {lowSupplies.length > 0 && (
            <Warn>Insumos abaixo do mínimo: {lowSupplies.join(', ')}</Warn>
          )}
          {lowProducts === 0 && lowSupplies.length === 0 && <Note>Nada acabando.</Note>}
        </Block>
        <Block title="Quanto sobra em cada vela" hint="pela ficha técnica" wide>
          <Margins report={report} />
        </Block>
      </Grid>
    </>
  );
}

function Margins({ report }: { report: Report }) {
  const missing = [...new Set(report.margins.flatMap((m) => m.missingSupplies))];
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-xs text-taupe">
              <th className="pb-1.5 text-left font-medium">Recipiente</th>
              <th className="pb-1.5 text-right font-medium">Preço</th>
              <th className="pb-1.5 text-right font-medium">Custo</th>
              <th className="pb-1.5 text-right font-medium">Sobra</th>
            </tr>
          </thead>
          <tbody>
            {report.margins.map((m) => (
              <tr key={m.model} className="border-t border-taupe/15">
                <td className="py-2">{m.model}</td>
                <td className="py-2 text-right">{formatBRL(m.priceCents)}</td>
                <td className="py-2 text-right">
                  {m.costCents === undefined ? '—' : formatBRL(m.costCents)}
                </td>
                <td className="py-2 text-right">
                  {m.costCents === undefined ? (
                    <span className="text-taupe">sem custo</span>
                  ) : (
                    <>
                      <b className="font-semibold">{formatBRL(m.priceCents - m.costCents)}</b> ·{' '}
                      {Math.round(((m.priceCents - m.costCents) / m.priceCents) * 100)}%
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Note>
        Custo = cera + essência + pavio + ilhós + frasco + adesivo da vela, pelo preço médio pago
        nas entradas. Não inclui sacola nem caixa. É a média entre os aromas que têm custo.
      </Note>
      {missing.length > 0 && (
        <Note>
          Sem custo ainda, porque nunca teve entrada com valor pago: {missing.join(', ')}.
        </Note>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Vendas
// ---------------------------------------------------------------------------

function Sales({
  report,
  previous,
  products,
}: {
  report: Report;
  previous: Report;
  products: Product[];
}) {
  const { sales } = report;
  return (
    <>
      <KpiGrid>
        <Kpi label="Faturamento" value={formatBRL(sales.revenueCents)}>
          <Delta current={sales.revenueCents} previous={previous.sales.revenueCents} />
        </Kpi>
        <Kpi label="Velas vendidas" value={String(sales.units)}>
          <Delta current={sales.units} previous={previous.sales.units} />
        </Kpi>
        <Kpi label="Vendas" value={String(sales.count)} />
        <Kpi label="Ticket médio" value={formatBRL(sales.ticketCents)} />
      </KpiGrid>
      <Grid>
        <Block title="Faturamento por dia" hint="maior dia em destaque" wide>
          <DailyRevenueChart days={sales.daily} />
        </Block>
        <Block title="Por recipiente" hint="faturamento">
          <Bars items={sales.byModel} format={formatBRL} empty="Nenhuma venda no período." />
        </Block>
        <Block title="Por aroma" hint="velas vendidas">
          <Bars items={sales.byScent} format={String} empty="Nenhuma venda no período." />
        </Block>
        <Block title="Descontos" hint="preço de tabela menos o cobrado">
          <p className="text-sm">
            {sales.discountCents > 0
              ? `${formatBRL(sales.discountCents)} em descontos, em ${pluralize(sales.discountedCount, 'venda', 'vendas')}.`
              : 'Nenhum desconto no período.'}
          </p>
        </Block>
        <Block
          title="Últimas vendas"
          hint={pluralize(sales.count, 'venda', 'vendas') + ' no período'}
        >
          {sales.list.length === 0 ? (
            <Note>Nenhuma venda no período.</Note>
          ) : (
            <ul>
              {sales.list.slice(0, 8).map((sale) => {
                const product = products.find((p) => p.id === sale.productId);
                return (
                  <Line
                    key={sale.id}
                    left={`${sale.quantity}× ${product?.scent ?? 'Vela removida'}`}
                    right={formatBRL(sale.totalCents ?? 0)}
                    detail={`${product?.model ?? ''} · ${when(sale)}`}
                  />
                );
              })}
            </ul>
          )}
        </Block>
      </Grid>
    </>
  );
}

// ---------------------------------------------------------------------------
// Produção
// ---------------------------------------------------------------------------

function Production({ report, previous }: { report: Report; previous: Report }) {
  const { production } = report;
  return (
    <>
      <KpiGrid>
        <Kpi label="Velas produzidas" value={String(production.units)}>
          <Delta current={production.units} previous={previous.production.units} />
        </Kpi>
        <Kpi label="Custo estimado" value={formatBRL(production.costCents)}>
          {!production.costComplete && (
            <span className="text-xs text-taupe">parcial: há insumo sem custo</span>
          )}
        </Kpi>
      </KpiGrid>
      <Grid>
        <Block title="Por recipiente" hint="velas">
          <Bars items={production.byModel} format={String} empty="Nenhuma produção no período." />
        </Block>
        <Block title="Por aroma" hint="velas">
          <Bars items={production.byScent} format={String} empty="Nenhuma produção no período." />
        </Block>
        <Block title="Insumos usados" hint="quantidade · custo" wide>
          {production.suppliesUsed.length === 0 ? (
            <Note>Nada consumido no período.</Note>
          ) : (
            <ul>
              {production.suppliesUsed.map((use) => (
                <Line
                  key={use.supplyId}
                  left={use.name}
                  right={
                    use.costCents === undefined ? (
                      <span className="font-normal text-taupe">sem custo</span>
                    ) : (
                      formatBRL(use.costCents)
                    )
                  }
                  detail={`${formatQuantity(use.quantity)} ${use.unit}`}
                />
              ))}
            </ul>
          )}
        </Block>
      </Grid>
    </>
  );
}

// ---------------------------------------------------------------------------
// Saídas de estoque
// ---------------------------------------------------------------------------

function Exits({ report }: { report: Report }) {
  const { exits } = report;
  const totalOut = exits.byReason.reduce((total, r) => total + r.value, 0);
  return (
    <>
      <Note>Tudo o que deixou o estoque no período, por motivo.</Note>
      <KpiGrid>
        <Kpi label="Velas que saíram" value={String(totalOut)} />
        <Kpi
          label="Perdas e brindes"
          value={formatBRL(exits.productLossCents + exits.supplyLossCents)}
        >
          {!exits.valueComplete && (
            <span className="text-xs text-taupe">parcial: há item sem custo</span>
          )}
        </Kpi>
      </KpiGrid>
      <Grid>
        <Block title="Velas, por motivo" hint="unidades">
          <Bars items={exits.byReason} format={String} empty="Nenhuma vela saiu no período." />
        </Block>
        <Block title="Velas que não viraram venda" hint="custo">
          {exits.productLosses.length === 0 ? (
            <Note>Nenhuma no período.</Note>
          ) : (
            <ul>
              {exits.productLosses.map((loss) => (
                <Line
                  key={loss.movement.id}
                  left={`${loss.reason} · ${loss.label}`}
                  right={loss.costCents === undefined ? '—' : formatBRL(loss.costCents)}
                  detail={`${units(loss.units)} · ${when(loss.movement)}`}
                />
              ))}
            </ul>
          )}
        </Block>
        <Block title="Insumos que saíram" hint="valor" wide>
          <Bars
            items={[
              { key: 'used', label: 'Usados na produção', value: exits.suppliesUsedCents },
              { key: 'lost', label: 'Perdas (derramou, quebrou…)', value: exits.supplyLossCents },
            ]}
            format={formatBRL}
            empty="Nenhum insumo saiu no período."
          />
          {exits.supplyLosses.length > 0 && (
            <ul>
              {exits.supplyLosses.map((loss) => (
                <Line
                  key={loss.movement.id}
                  left={`${loss.reason} · ${loss.label}`}
                  right={loss.costCents === undefined ? '—' : formatBRL(loss.costCents)}
                  detail={`${formatQuantity(loss.units)} ${loss.unit} · ${when(loss.movement)}`}
                />
              ))}
            </ul>
          )}
        </Block>
      </Grid>
    </>
  );
}

// ---------------------------------------------------------------------------
// Gastos
// ---------------------------------------------------------------------------

function Spending({ report, previous }: { report: Report; previous: Report }) {
  const { spending } = report;
  const [category, setCategory] = useState<string | undefined>();
  const [query, setQuery] = useState('');

  const rows = spending.bySupply
    .filter((row) => !category || row.category === category)
    .filter((row) => !query.trim() || matchesQuery(row.name, query));
  const focus = category ?? (query.trim() ? `“${query.trim()}”` : undefined);
  const focusTotal = rows.reduce((total, row) => total + row.totalCents, 0);

  return (
    <>
      <Hero label="Gasto com insumos no período" cents={spending.totalCents}>
        <Delta
          current={spending.totalCents}
          previous={previous.spending.totalCents}
          upIsGood={false}
        />
      </Hero>
      {spending.unpricedCount > 0 && (
        <Warn>
          {pluralize(spending.unpricedCount, 'entrada', 'entradas')} sem valor pago não{' '}
          {spending.unpricedCount === 1 ? 'está somada' : 'estão somadas'} aqui.
        </Warn>
      )}
      <Grid>
        <Block title="Por categoria" hint="toque para detalhar">
          <Bars
            items={spending.byCategory}
            format={formatBRL}
            selected={category}
            onSelect={(key) => {
              setCategory((current) => (current === key ? undefined : key));
              setQuery('');
            }}
            empty="Nenhuma compra com valor no período."
          />
        </Block>
        <div className="flex flex-col gap-3">
          <Field label="Quanto gastei com…" htmlFor="spending-search">
            <input
              id="spending-search"
              type="search"
              className={inputClassName}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCategory(undefined);
              }}
              placeholder="ex.: lavanda, frasco, cera"
              autoComplete="off"
            />
          </Field>
          <Block
            title={focus ? `Gasto com ${focus}` : 'Por insumo'}
            hint={focus ? formatBRL(focusTotal) : 'total · custo médio'}
          >
            {rows.length === 0 ? (
              <Note>Nenhuma compra encontrada.</Note>
            ) : (
              <ul>
                {rows.map((row) => (
                  <Line
                    key={row.supplyId}
                    left={row.name}
                    right={formatBRL(row.totalCents)}
                    detail={`${pluralize(row.purchases, 'compra', 'compras')} · ${formatQuantity(row.quantity)} ${row.unit} · ${formatUnitCost(row.totalCents, row.quantity, row.unit)}`}
                  />
                ))}
              </ul>
            )}
            {focus && (
              <button
                type="button"
                onClick={() => {
                  setCategory(undefined);
                  setQuery('');
                }}
                className="self-center text-sm font-medium text-taupe underline underline-offset-2"
              >
                Ver todos os insumos
              </button>
            )}
          </Block>
        </div>
      </Grid>
    </>
  );
}

// ---------------------------------------------------------------------------
// Histórico
// ---------------------------------------------------------------------------

function History({
  report,
  inventory,
  isOnline,
}: {
  report: Report;
  inventory: UseInventoryReturn;
  isOnline: boolean;
}) {
  const { products, supplies, undo } = inventory;

  async function handleUndo(movement: Movement) {
    if (!window.confirm('Desfazer este lançamento? O efeito no estoque será revertido.')) return;
    const result = await undo(movement.id);
    if (!result.ok) {
      window.alert(
        result.reason === 'negative_result'
          ? `Não é possível desfazer: o estoque ficaria negativo (${result.resulting}).`
          : result.reason === 'already_undone'
            ? 'Este lançamento já foi desfeito.'
            : 'Não foi possível desfazer este lançamento.',
      );
    }
  }

  if (report.movements.length === 0) return <Note>Nenhum lançamento no período.</Note>;

  return (
    <ul className="flex flex-col gap-2">
      {report.movements.map((movement) => (
        <li
          key={movement.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-taupe/20 bg-paper p-3"
        >
          <div className="min-w-0">
            <p className="font-medium">
              {MOVEMENT_LABELS[movement.type]} · {describeMovement(movement, products, supplies)}
            </p>
            <p className="text-sm text-taupe">
              {new Date(movement.occurredAt).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
              {movement.totalCents !== undefined ? ` · ${formatBRL(movement.totalCents)}` : ''}
              {movement.note ? ` · ${movement.note}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleUndo(movement)}
            disabled={!isOnline}
            title={!isOnline ? 'Indisponível offline' : undefined}
            className="shrink-0 rounded-md px-3 py-2 text-sm font-medium text-alert hover:bg-alert/10 disabled:opacity-50"
          >
            Desfazer
          </button>
        </li>
      ))}
    </ul>
  );
}
