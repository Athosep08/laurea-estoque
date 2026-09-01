import { useMemo, useState } from 'react';
import type { Movement, MovementType } from '../../domain/models';
import { formatBRL } from '../../domain/money';
import type { UseInventoryReturn } from '../hooks/useInventory';

type ReportScreenProps = {
  inventory: UseInventoryReturn;
};

const MOVEMENT_LABELS: Record<MovementType, string> = {
  production: 'Produção',
  sale: 'Venda',
  adjustment: 'Ajuste',
  supply_purchase: 'Compra de insumo',
};

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function ReportScreen({ inventory }: ReportScreenProps) {
  const { products, supplies, undo, report } = inventory;
  const [yearMonth, setYearMonth] = useState(currentYearMonth());

  const [year, month] = yearMonth.split('-').map(Number);
  const data = useMemo(() => report(year, month), [report, year, month]);

  function movementSubject(movement: Movement): string {
    if (movement.productId) {
      const product = products.find((p) => p.id === movement.productId);
      return product ? `${product.model} — ${product.scent}` : 'Vela removida';
    }
    if (movement.supplyId) {
      const supply = supplies.find((s) => s.id === movement.supplyId);
      return supply ? supply.name : 'Insumo removido';
    }
    return '—';
  }

  function handleUndo(movement: Movement) {
    if (!window.confirm('Desfazer este movimento? O efeito no estoque será revertido.')) {
      return;
    }
    const result = undo(movement.id);
    if (!result.ok) {
      window.alert(describeUndoError(result));
    }
  }

  return (
    <section>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Relatório</h1>
        <label className="flex items-center gap-2 text-sm font-medium text-taupe">
          Mês
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="rounded-md border border-taupe/40 bg-paper px-3 py-2 text-ink"
          />
        </label>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Velas produzidas" value={String(data.totalProduced)} />
        <SummaryCard label="Velas vendidas" value={String(data.totalSold)} />
        <SummaryCard label="Faturamento" value={formatBRL(data.totalRevenueCents)} />
      </div>

      <h2 className="mb-2 text-lg font-semibold text-taupe">Por produto</h2>

      {/* Mobile: cartões empilhados */}
      <div className="mb-6 space-y-2 md:hidden">
        {data.byProduct.map((row) => (
          <div key={row.productId} className="rounded-lg border border-taupe/20 bg-paper p-3">
            <p className="font-medium">
              {row.model} — {row.scent}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-taupe">
              <dt>Produzidas</dt>
              <dd className="text-right text-ink">{row.produced}</dd>
              <dt>Vendidas</dt>
              <dd className="text-right text-ink">{row.sold}</dd>
              <dt>Faturamento</dt>
              <dd className="text-right text-ink">{formatBRL(row.revenueCents)}</dd>
              <dt>Estoque atual</dt>
              <dd className="text-right text-ink">{row.currentStock}</dd>
            </dl>
          </div>
        ))}
      </div>

      {/* Desktop: tabela completa */}
      <div className="mb-6 hidden overflow-x-auto rounded-lg border border-taupe/20 md:block">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-taupe">
            <tr>
              <th className="px-3 py-2">Produto</th>
              <th className="px-3 py-2 text-right">Produzidas</th>
              <th className="px-3 py-2 text-right">Vendidas</th>
              <th className="px-3 py-2 text-right">Faturamento</th>
              <th className="px-3 py-2 text-right">Estoque atual</th>
            </tr>
          </thead>
          <tbody>
            {data.byProduct.map((row) => (
              <tr key={row.productId} className="border-t border-taupe/10">
                <td className="px-3 py-2">
                  {row.model} — {row.scent}
                </td>
                <td className="px-3 py-2 text-right">{row.produced}</td>
                <td className="px-3 py-2 text-right">{row.sold}</td>
                <td className="px-3 py-2 text-right">{formatBRL(row.revenueCents)}</td>
                <td className="px-3 py-2 text-right">{row.currentStock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-lg font-semibold text-taupe">Histórico do mês</h2>
      <ul className="space-y-2">
        {data.movements.length === 0 && <p className="text-taupe">Nenhum movimento neste mês.</p>}
        {data.movements.map((movement) => (
          <li
            key={movement.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-taupe/20 bg-paper p-3"
          >
            <div>
              <p className="font-medium">
                {MOVEMENT_LABELS[movement.type]} — {movementSubject(movement)}
              </p>
              <p className="text-sm text-taupe">
                {new Date(movement.occurredAt).toLocaleString('pt-BR')} · qtd. {movement.quantity}
                {movement.totalCents !== undefined ? ` · ${formatBRL(movement.totalCents)}` : ''}
                {movement.note ? ` · ${movement.note}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleUndo(movement)}
              className="shrink-0 rounded-md px-3 py-2 text-sm font-medium text-alert hover:bg-alert/10"
            >
              Desfazer
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-taupe/20 bg-paper p-4">
      <p className="text-sm text-taupe">{label}</p>
      <p className="font-display text-2xl">{value}</p>
    </div>
  );
}

function describeUndoError(result: { ok: false; reason: string; resulting?: number }): string {
  if (result.reason === 'negative_result') {
    return `Não é possível desfazer: o estoque ficaria negativo (${result.resulting}).`;
  }
  if (result.reason === 'already_undone') {
    return 'Este movimento já foi desfeito.';
  }
  return 'Não foi possível desfazer este movimento.';
}
