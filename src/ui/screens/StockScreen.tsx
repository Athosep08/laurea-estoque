import { useState } from 'react';
import type { Product, Supply } from '../../domain/models';
import { isLowStock } from '../../domain/inventory';
import { formatBRL } from '../../domain/money';
import { formatQuantity } from '../../domain/quantity';
import type { UseInventoryReturn } from '../hooks/useInventory';
import { Dialog } from '../components/Dialog';
import { LowStockBadge } from '../components/LowStockBadge';
import { inputClassName } from '../components/Field';
import { ProductForm } from '../components/ProductForm';
import { SupplyForm } from '../components/SupplyForm';
import {
  byName,
  formatModelPrice,
  lowStockFirst,
  matchesQuery,
  pluralize,
  summarizeModels,
} from './catalog';

type StockScreenProps = {
  inventory: UseInventoryReturn;
  isOnline: boolean;
};

type Tab = 'products' | 'supplies';

type DialogState =
  | { kind: 'none' }
  | { kind: 'productDetail'; product: Product }
  | { kind: 'productForm'; product?: Product; defaults?: { model: string; priceCents: number } }
  | { kind: 'supplyDetail'; supply: Supply }
  | { kind: 'supplyForm'; supply?: Supply };

/**
 * Consulta e cadastro. Nenhuma lista tem botão de ação: tocar numa linha abre
 * os detalhes, e é de lá que se edita. Os lançamentos (vender, produzir…)
 * ficam no Início.
 */
export function StockScreen({ inventory, isOnline }: StockScreenProps) {
  const { products, supplies, recipes } = inventory;
  const [tab, setTab] = useState<Tab>('products');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' });

  const models = summarizeModels(products);
  const current = models.find((m) => m.model === selectedModel);
  const closeDialog = () => setDialog({ kind: 'none' });
  // O <dialog> nativo avisa quando fecha. Ao trocar de um diálogo para outro
  // (detalhe -> editar), o que saiu não pode apagar o que acabou de abrir.
  const closeIf = (kind: DialogState['kind']) => () =>
    setDialog((current) => (current.kind === kind ? { kind: 'none' } : current));
  const switchTab = (next: Tab) => {
    setTab(next);
    setSelectedModel(null);
    setQuery('');
  };

  const addButton = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!isOnline}
      title={!isOnline ? 'Indisponível offline' : undefined}
      className="shrink-0 rounded-md bg-ink px-3 py-2 text-sm font-medium text-paper hover:bg-ink/90 disabled:opacity-50"
    >
      {label}
    </button>
  );

  return (
    <section className="flex flex-col gap-4">
      {current && (
        <button
          type="button"
          onClick={() => {
            setSelectedModel(null);
            setQuery('');
          }}
          className="-ml-2 self-start rounded-md px-2 py-1 text-sm font-medium text-taupe hover:bg-paper"
        >
          ‹ Recipientes
        </button>
      )}

      <header className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">{current ? current.model : 'Estoque'}</h1>
        {tab === 'products' &&
          addButton(current ? '+ Novo aroma' : '+ Nova vela', () =>
            setDialog({
              kind: 'productForm',
              defaults: current
                ? { model: current.model, priceCents: current.minPriceCents }
                : undefined,
            }),
          )}
        {tab === 'supplies' && addButton('+ Novo insumo', () => setDialog({ kind: 'supplyForm' }))}
      </header>

      {current ? (
        <p className="-mt-3 text-sm text-taupe">
          {formatModelPrice(current)} · {pluralize(current.count, 'aroma', 'aromas')} ·{' '}
          {current.units} un. em estoque
        </p>
      ) : (
        <div
          role="tablist"
          aria-label="O que consultar"
          className="grid grid-cols-2 gap-1 rounded-lg bg-taupe/10 p-1"
        >
          {(
            [
              ['products', 'Velas'],
              ['supplies', 'Insumos'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => switchTab(id)}
              className={`rounded-md py-2 text-sm font-semibold ${tab === id ? 'bg-paper text-ink shadow-sm' : 'text-taupe'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === 'products' && !current && (
        <>
          {products.length === 0 && (
            <p className="text-taupe">Nenhuma vela cadastrada ainda. Comece criando uma.</p>
          )}
          <ul className="grid gap-3 sm:grid-cols-3">
            {models.map((summary) => (
              <li key={summary.model}>
                <button
                  type="button"
                  onClick={() => setSelectedModel(summary.model)}
                  className="flex h-full w-full items-center justify-between gap-3 rounded-lg border border-taupe/20 bg-paper p-4 text-left shadow-sm hover:border-gold/60"
                >
                  <span>
                    <span className="block font-display text-xl">{summary.model}</span>
                    <span className="block text-sm text-taupe">
                      {formatModelPrice(summary)} · {pluralize(summary.count, 'aroma', 'aromas')}
                    </span>
                    <span className="mt-2 block text-sm">{summary.units} un. em estoque</span>
                    {summary.lowCount > 0 && (
                      <span className="block text-sm text-alert">
                        {summary.lowCount} com estoque baixo
                      </span>
                    )}
                  </span>
                  <span aria-hidden="true" className="text-2xl text-taupe">
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'products' && current && (
        <>
          <input
            type="search"
            aria-label="Buscar aroma"
            className={inputClassName}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ex.: lavanda"
            autoComplete="off"
          />
          <RowList
            empty={`Nenhum aroma encontrado para “${query.trim()}”.`}
            rows={lowStockFirst(
              products.filter((p) => p.model === current.model && matchesQuery(p.scent, query)),
            ).map((product) => ({
              id: product.id,
              name: product.scent,
              note: isLowStock(product)
                ? product.quantity === 0
                  ? 'Zerado'
                  : 'Estoque baixo'
                : undefined,
              value: `${product.quantity} un.`,
              low: isLowStock(product),
              onClick: () => setDialog({ kind: 'productDetail', product }),
            }))}
          />
        </>
      )}

      {tab === 'supplies' && (
        <>
          <input
            type="search"
            aria-label="Buscar insumo"
            className={inputClassName}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ex.: cera, lavanda, frasco"
            autoComplete="off"
          />
          {supplies.length === 0 && (
            <p className="text-taupe">Nenhum insumo cadastrado ainda. Comece criando um.</p>
          )}
          <RowList
            empty={`Nenhum insumo encontrado para “${query.trim()}”.`}
            rows={[...supplies]
              .filter((s) => matchesQuery(s.name, query))
              .sort((a, b) => Number(isLowStock(b)) - Number(isLowStock(a)) || byName(a, b))
              .map((supply) => ({
                id: supply.id,
                name: supply.name,
                note: isLowStock(supply)
                  ? `Abaixo do mínimo (${formatQuantity(supply.minQuantity)} ${supply.unit})`
                  : undefined,
                value: `${formatQuantity(supply.quantity)} ${supply.unit}`,
                low: isLowStock(supply),
                onClick: () => setDialog({ kind: 'supplyDetail', supply }),
              }))}
          />
        </>
      )}

      <Dialog
        open={dialog.kind === 'productDetail'}
        title={dialog.kind === 'productDetail' ? dialog.product.scent : ''}
        onClose={closeIf('productDetail')}
      >
        {dialog.kind === 'productDetail' && (
          <ProductDetail
            product={dialog.product}
            recipeItems={
              recipes
                .find((r) => r.id === dialog.product.recipeId)
                ?.items.map((item) => {
                  const supply = supplies.find((s) => s.id === item.supplyId);
                  return `${formatQuantity(item.quantityPerUnit)} ${supply?.unit ?? ''} ${supply?.name ?? 'insumo removido'}`;
                }) ?? []
            }
            isOnline={isOnline}
            onEdit={() => setDialog({ kind: 'productForm', product: dialog.product })}
          />
        )}
      </Dialog>

      <Dialog
        open={dialog.kind === 'productForm'}
        title={dialog.kind === 'productForm' && dialog.product ? 'Editar vela' : 'Nova vela'}
        onClose={closeIf('productForm')}
      >
        {dialog.kind === 'productForm' && (
          <ProductForm
            key={dialog.product?.id ?? 'new'}
            product={dialog.product}
            recipe={recipes.find((r) => r.id === dialog.product?.recipeId)}
            supplies={supplies}
            defaults={dialog.defaults}
            onCancel={closeDialog}
            onSubmit={async (values) => {
              const existing = dialog.product;
              let recipeId = existing?.recipeId;
              if (values.recipeItems.length > 0) {
                recipeId = recipeId ?? crypto.randomUUID();
                await inventory.saveRecipe({
                  id: recipeId,
                  name: `${values.model} ${values.scent} — ficha técnica`,
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
              // Vela nova: abre o recipiente dela, para ela aparecer na tela.
              if (!existing) {
                setSelectedModel(values.model);
                setQuery('');
              }
              closeDialog();
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={dialog.kind === 'supplyDetail'}
        title={dialog.kind === 'supplyDetail' ? dialog.supply.name : ''}
        onClose={closeIf('supplyDetail')}
      >
        {dialog.kind === 'supplyDetail' && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-taupe">Em estoque</dt>
              <dd className="text-right tabular-nums">
                {formatQuantity(dialog.supply.quantity)} {dialog.supply.unit}
              </dd>
              <dt className="text-taupe">Alerta a partir de</dt>
              <dd className="text-right tabular-nums">
                {formatQuantity(dialog.supply.minQuantity)} {dialog.supply.unit}
              </dd>
            </dl>
            <button
              type="button"
              onClick={() => setDialog({ kind: 'supplyForm', supply: dialog.supply })}
              disabled={!isOnline}
              className="rounded-lg border border-taupe/30 px-4 py-2 font-semibold disabled:opacity-50"
            >
              Editar insumo
            </button>
          </div>
        )}
      </Dialog>

      <Dialog
        open={dialog.kind === 'supplyForm'}
        title={dialog.kind === 'supplyForm' && dialog.supply ? 'Editar insumo' : 'Novo insumo'}
        onClose={closeIf('supplyForm')}
      >
        {dialog.kind === 'supplyForm' && (
          <SupplyForm
            key={dialog.supply?.id ?? 'new'}
            supply={dialog.supply}
            onCancel={closeDialog}
            onSubmit={async (values) => {
              const existing = dialog.supply;
              await inventory.saveSupply({
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
    </section>
  );
}

type Row = {
  id: string;
  name: string;
  note?: string;
  value: string;
  low: boolean;
  onClick: () => void;
};

function RowList({ rows, empty }: { rows: Row[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-taupe">{empty}</p>;
  return (
    <ul className="overflow-hidden rounded-lg border border-taupe/20 bg-paper">
      {rows.map((row) => (
        <li key={row.id} className="border-b border-taupe/20 last:border-b-0">
          <button
            type="button"
            onClick={row.onClick}
            className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-cream"
          >
            <span className="min-w-0">
              <span className="block font-medium">{row.name}</span>
              {row.note && <span className="block text-xs text-alert">{row.note}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className={`text-sm tabular-nums ${row.low ? 'font-semibold text-alert' : ''}`}>
                {row.value}
              </span>
              <span aria-hidden="true" className="text-lg text-taupe">
                ›
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ProductDetail({
  product,
  recipeItems,
  isOnline,
  onEdit,
}: {
  product: Product;
  recipeItems: string[];
  isOnline: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-2 flex items-center justify-between gap-2 text-sm text-taupe">
        {product.model}
        {isLowStock(product) && <LowStockBadge />}
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-taupe">Em estoque</dt>
        <dd className="text-right tabular-nums">{product.quantity} un.</dd>
        <dt className="text-taupe">Preço</dt>
        <dd className="text-right tabular-nums">{formatBRL(product.priceCents)}</dd>
        <dt className="text-taupe">Alerta a partir de</dt>
        <dd className="text-right tabular-nums">{product.minQuantity} un.</dd>
      </dl>
      <div>
        <p className="mb-1 text-sm text-taupe">Ficha técnica (por vela)</p>
        {recipeItems.length === 0 ? (
          <p className="text-sm">Sem ficha técnica: produzir não dá baixa em insumo.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {recipeItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={onEdit}
        disabled={!isOnline}
        className="rounded-lg border border-taupe/30 px-4 py-2 font-semibold disabled:opacity-50"
      >
        Editar vela
      </button>
    </div>
  );
}
