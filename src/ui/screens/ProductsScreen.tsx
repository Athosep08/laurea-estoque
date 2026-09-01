import { useState } from 'react';
import type { Product } from '../../domain/models';
import { isLowStock } from '../../domain/inventory';
import { formatBRL } from '../../domain/money';
import type { UseInventoryReturn } from '../hooks/useInventory';
import { Dialog } from '../components/Dialog';
import { LowStockBadge } from '../components/LowStockBadge';
import { ProductForm } from '../components/ProductForm';
import { SellForm } from '../components/SellForm';
import { ProduceForm } from '../components/ProduceForm';
import { AdjustForm } from '../components/AdjustForm';

type ProductsScreenProps = {
  inventory: UseInventoryReturn;
  isOnline: boolean;
};

type DialogState =
  | { kind: 'none' }
  | { kind: 'form'; product?: Product }
  | { kind: 'sell'; product: Product }
  | { kind: 'produce'; product: Product }
  | { kind: 'adjust'; product: Product };

export function ProductsScreen({ inventory, isOnline }: ProductsScreenProps) {
  const { products, supplies, recipes } = inventory;
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' });
  const [actionError, setActionError] = useState<string | undefined>();

  const grouped = groupByModel(products);
  const closeDialog = () => {
    setDialog({ kind: 'none' });
    setActionError(undefined);
  };

  return (
    <section>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Velas</h1>
        <button
          type="button"
          onClick={() => setDialog({ kind: 'form' })}
          disabled={!isOnline}
          title={!isOnline ? 'Indisponível offline' : undefined}
          className="rounded-md bg-ink px-4 py-2 font-medium text-paper hover:bg-ink/90 disabled:opacity-50"
        >
          + Nova vela
        </button>
      </header>

      {products.length === 0 && (
        <p className="text-taupe">Nenhuma vela cadastrada ainda. Comece criando uma.</p>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from(grouped.entries()).map(([model, items]) => (
          <div key={model} className="sm:col-span-2 lg:col-span-3">
            <h2 className="mb-2 text-lg font-semibold text-taupe">{model}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((product) => (
                <article
                  key={product.id}
                  className="rounded-lg border border-taupe/20 bg-paper p-4 shadow-sm"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{product.scent}</p>
                      <p className="text-sm text-taupe">{formatBRL(product.priceCents)}</p>
                    </div>
                    {isLowStock(product) && <LowStockBadge />}
                  </div>
                  <p className="mb-3 text-2xl font-display">
                    {product.quantity} <span className="text-sm text-taupe">un.</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setDialog({ kind: 'sell', product })}
                      disabled={!isOnline}
                      title={!isOnline ? 'Indisponível offline' : undefined}
                      className="rounded-md bg-ok/10 px-3 py-2 text-sm font-medium text-ok hover:bg-ok/20 disabled:opacity-50"
                    >
                      Vender
                    </button>
                    <button
                      type="button"
                      onClick={() => setDialog({ kind: 'produce', product })}
                      disabled={!isOnline}
                      title={!isOnline ? 'Indisponível offline' : undefined}
                      className="rounded-md bg-gold/10 px-3 py-2 text-sm font-medium text-gold hover:bg-gold/20 disabled:opacity-50"
                    >
                      Produzir
                    </button>
                    <button
                      type="button"
                      onClick={() => setDialog({ kind: 'adjust', product })}
                      disabled={!isOnline}
                      title={!isOnline ? 'Indisponível offline' : undefined}
                      className="rounded-md px-3 py-2 text-sm font-medium text-taupe hover:bg-cream disabled:opacity-50"
                    >
                      Ajustar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDialog({ kind: 'form', product })}
                      disabled={!isOnline}
                      title={!isOnline ? 'Indisponível offline' : undefined}
                      className="rounded-md px-3 py-2 text-sm font-medium text-taupe hover:bg-cream disabled:opacity-50"
                    >
                      Editar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog
        open={dialog.kind === 'form'}
        title={dialog.kind === 'form' && dialog.product ? 'Editar vela' : 'Nova vela'}
        onClose={closeDialog}
      >
        {dialog.kind === 'form' && (
          <ProductForm
            key={dialog.product?.id ?? 'new'}
            product={dialog.product}
            recipe={recipes.find((r) => r.id === dialog.product?.recipeId)}
            supplies={supplies}
            onCancel={closeDialog}
            onSubmit={async (values) => {
              const existing = dialog.product;
              let recipeId = existing?.recipeId;

              if (values.recipeItems.length > 0) {
                recipeId = recipeId ?? crypto.randomUUID();
                await inventory.saveRecipe({
                  id: recipeId,
                  name: `${values.model} — ficha técnica`,
                  items: values.recipeItems,
                });
              } else {
                recipeId = undefined;
              }

              await inventory.saveProduct({
                id: existing?.id ?? crypto.randomUUID(),
                model: values.model,
                scent: values.scent,
                priceCents: values.priceCents,
                quantity: existing?.quantity ?? values.quantity,
                minQuantity: values.minQuantity,
                recipeId,
                active: values.active,
                createdAt: existing?.createdAt ?? new Date().toISOString(),
              });
              closeDialog();
            }}
          />
        )}
      </Dialog>

      <Dialog open={dialog.kind === 'sell'} title="Registrar venda" onClose={closeDialog}>
        {dialog.kind === 'sell' && (
          <SellForm
            product={dialog.product}
            error={actionError}
            onCancel={closeDialog}
            onSubmit={async (values) => {
              const result = await inventory.sell({ productId: dialog.product.id, ...values });
              if (result.ok) {
                closeDialog();
              } else if (result.reason === 'insufficient_stock') {
                setActionError(
                  `Estoque insuficiente: há ${result.available}, pedido de ${result.requested}.`,
                );
              } else {
                setActionError('Não foi possível registrar a venda.');
              }
            }}
          />
        )}
      </Dialog>

      <Dialog open={dialog.kind === 'produce'} title="Registrar produção" onClose={closeDialog}>
        {dialog.kind === 'produce' && (
          <ProduceForm
            product={dialog.product}
            error={actionError}
            onCancel={closeDialog}
            onSubmit={async (values) => {
              const result = await inventory.produce({ productId: dialog.product.id, ...values });
              if (result.ok) {
                closeDialog();
              } else if (result.reason === 'missing_supplies') {
                const lines = result.missing.map((m) => {
                  const supply = supplies.find((s) => s.id === m.supplyId);
                  const name = supply?.name ?? m.supplyId;
                  const unit = supply?.unit ?? '';
                  return `${name}: faltam ${(m.required - m.available).toFixed(2)} ${unit}`;
                });
                setActionError(`Insumo insuficiente:\n${lines.join('\n')}`);
              } else {
                setActionError('Não foi possível registrar a produção.');
              }
            }}
          />
        )}
      </Dialog>

      <Dialog open={dialog.kind === 'adjust'} title="Ajuste manual" onClose={closeDialog}>
        {dialog.kind === 'adjust' && (
          <AdjustForm
            currentLabel={`${dialog.product.model} — ${dialog.product.scent}. Em estoque: ${dialog.product.quantity}.`}
            error={actionError}
            onCancel={closeDialog}
            onSubmit={async (values) => {
              const result = await inventory.adjust({
                target: 'product',
                id: dialog.product.id,
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

function groupByModel(products: Product[]): Map<string, Product[]> {
  const sorted = [...products].sort((a, b) => {
    const lowA = isLowStock(a);
    const lowB = isLowStock(b);
    if (lowA !== lowB) return lowA ? -1 : 1;
    return a.scent.localeCompare(b.scent);
  });

  const map = new Map<string, Product[]>();
  for (const product of sorted) {
    const list = map.get(product.model) ?? [];
    list.push(product);
    map.set(product.model, list);
  }
  return map;
}
