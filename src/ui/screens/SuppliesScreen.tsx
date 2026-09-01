import { useState } from 'react';
import type { Supply } from '../../domain/models';
import { isLowStock } from '../../domain/inventory';
import type { UseInventoryReturn } from '../hooks/useInventory';
import { Dialog } from '../components/Dialog';
import { LowStockBadge } from '../components/LowStockBadge';
import { SupplyForm } from '../components/SupplyForm';
import { PurchaseForm } from '../components/PurchaseForm';
import { AdjustForm } from '../components/AdjustForm';

type SuppliesScreenProps = {
  inventory: UseInventoryReturn;
};

type DialogState =
  | { kind: 'none' }
  | { kind: 'form'; supply?: Supply }
  | { kind: 'purchase'; supply: Supply }
  | { kind: 'adjust'; supply: Supply };

export function SuppliesScreen({ inventory }: SuppliesScreenProps) {
  const { supplies } = inventory;
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' });
  const [actionError, setActionError] = useState<string | undefined>();

  const sorted = [...supplies].sort((a, b) => {
    const lowA = isLowStock(a);
    const lowB = isLowStock(b);
    if (lowA !== lowB) return lowA ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const closeDialog = () => {
    setDialog({ kind: 'none' });
    setActionError(undefined);
  };

  return (
    <section>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Insumos</h1>
        <button
          type="button"
          onClick={() => setDialog({ kind: 'form' })}
          className="rounded-md bg-ink px-4 py-2 font-medium text-paper hover:bg-ink/90"
        >
          + Novo insumo
        </button>
      </header>

      {supplies.length === 0 && (
        <p className="text-taupe">Nenhum insumo cadastrado ainda. Comece criando um.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((supply) => (
          <article
            key={supply.id}
            className="rounded-lg border border-taupe/20 bg-paper p-4 shadow-sm"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="font-medium">{supply.name}</p>
              {isLowStock(supply) && <LowStockBadge />}
            </div>
            <p className="mb-3 text-2xl font-display">
              {supply.quantity} <span className="text-sm text-taupe">{supply.unit}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDialog({ kind: 'purchase', supply })}
                className="rounded-md bg-ok/10 px-3 py-2 text-sm font-medium text-ok hover:bg-ok/20"
              >
                Registrar compra
              </button>
              <button
                type="button"
                onClick={() => setDialog({ kind: 'adjust', supply })}
                className="rounded-md px-3 py-2 text-sm font-medium text-taupe hover:bg-cream"
              >
                Ajustar
              </button>
              <button
                type="button"
                onClick={() => setDialog({ kind: 'form', supply })}
                className="rounded-md px-3 py-2 text-sm font-medium text-taupe hover:bg-cream"
              >
                Editar
              </button>
            </div>
          </article>
        ))}
      </div>

      <Dialog
        open={dialog.kind === 'form'}
        title={dialog.kind === 'form' && dialog.supply ? 'Editar insumo' : 'Novo insumo'}
        onClose={closeDialog}
      >
        {dialog.kind === 'form' && (
          <SupplyForm
            key={dialog.supply?.id ?? 'new'}
            supply={dialog.supply}
            onCancel={closeDialog}
            onSubmit={(values) => {
              const existing = dialog.supply;
              inventory.saveSupply({
                id: existing?.id ?? crypto.randomUUID(),
                name: values.name,
                unit: values.unit,
                quantity: existing?.quantity ?? values.quantity,
                minQuantity: values.minQuantity,
                createdAt: existing?.createdAt ?? new Date().toISOString(),
              });
              closeDialog();
            }}
          />
        )}
      </Dialog>

      <Dialog open={dialog.kind === 'purchase'} title="Registrar compra" onClose={closeDialog}>
        {dialog.kind === 'purchase' && (
          <PurchaseForm
            supply={dialog.supply}
            onCancel={closeDialog}
            onSubmit={(values) => {
              inventory.purchaseSupply({ supplyId: dialog.supply.id, ...values });
              closeDialog();
            }}
          />
        )}
      </Dialog>

      <Dialog open={dialog.kind === 'adjust'} title="Ajuste manual" onClose={closeDialog}>
        {dialog.kind === 'adjust' && (
          <AdjustForm
            currentLabel={`${dialog.supply.name}. Em estoque: ${dialog.supply.quantity} ${dialog.supply.unit}.`}
            error={actionError}
            onCancel={closeDialog}
            onSubmit={(values) => {
              const result = inventory.adjust({
                target: 'supply',
                id: dialog.supply.id,
                ...values,
              });
              if (result.ok) {
                closeDialog();
              } else if (result.reason === 'negative_result') {
                setActionError(`O ajuste deixaria o estoque negativo (${result.resulting}).`);
              } else {
                setActionError('Não foi possível registrar o ajuste.');
              }
            }}
          />
        )}
      </Dialog>
    </section>
  );
}
