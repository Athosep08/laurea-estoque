import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Movement, Product, Supply } from '../../domain/models';
import { isLowStock } from '../../domain/inventory';
import { formatBRL } from '../../domain/money';
import { formatQuantity } from '../../domain/quantity';
import type { UseInventoryReturn } from '../hooks/useInventory';
import { failureMessage } from '../failureMessage';
import { inputClassName } from '../components/Field';
import { SellForm } from '../components/SellForm';
import { ProduceForm } from '../components/ProduceForm';
import { PurchaseForm } from '../components/PurchaseForm';
import { AdjustForm } from '../components/AdjustForm';
import {
  MOVEMENT_LABELS,
  byName,
  byScent,
  describeMovement,
  formatModelPrice,
  matchesQuery,
  missingForProduction,
  pluralize,
  productLabel,
  summarizeModels,
} from './catalog';

type Action = 'sell' | 'produce' | 'purchase' | 'adjust';

/** Motivos em botão no ajuste. O relatório de Saídas soma por eles. */
const PRODUCT_ADJUST_REASONS = ['Brinde', 'Quebrou', 'Sumiu', 'Recontagem'];
const SUPPLY_ADJUST_REASONS = ['Derramou', 'Quebrou', 'Venceu', 'Recontagem'];

type Step =
  | { kind: 'menu' }
  | { kind: 'adjustTarget' }
  | { kind: 'pickModel'; action: Action }
  | { kind: 'pickProduct'; action: Action; model: string }
  | { kind: 'pickSupply'; action: Action }
  | { kind: 'form'; action: Action; productId?: string; supplyId?: string }
  | { kind: 'done'; action: Action; movement: Movement; undone: boolean };

/** Classes completas por ação (o Tailwind só enxerga classes escritas por inteiro). */
const ACTIONS: Record<
  Action,
  {
    label: string;
    hint: string;
    tag: string;
    done: string;
    undone: string;
    again: string;
    tone: string;
    solid: string;
  }
> = {
  sell: {
    label: 'Vender',
    hint: 'Vela que saiu',
    tag: 'Vender',
    done: 'Venda registrada',
    undone: 'Venda desfeita',
    again: 'Registrar outra venda',
    tone: 'bg-ok/10 text-ok',
    solid: 'bg-ok hover:bg-ok/90',
  },
  produce: {
    label: 'Produzir',
    hint: 'Consome a ficha técnica',
    tag: 'Produzir',
    done: 'Produção registrada',
    undone: 'Produção desfeita',
    again: 'Produzir outra',
    tone: 'bg-gold/10 text-gold',
    solid: 'bg-gold hover:bg-gold/90',
  },
  purchase: {
    label: 'Entrada de insumo',
    hint: 'Cera, essência, frasco…',
    tag: 'Entrada',
    done: 'Entrada registrada',
    undone: 'Entrada desfeita',
    again: 'Registrar outra entrada',
    tone: 'bg-ink/10 text-ink',
    solid: 'bg-ink hover:bg-ink/90',
  },
  adjust: {
    label: 'Ajustar',
    hint: 'Quebra, perda, recontagem',
    tag: 'Ajustar',
    done: 'Ajuste registrado',
    undone: 'Ajuste desfeito',
    again: 'Fazer outro ajuste',
    tone: 'bg-taupe/15 text-taupe',
    solid: 'bg-taupe hover:bg-taupe/90',
  },
};

const TILE_ORDER: Action[] = ['sell', 'produce', 'purchase', 'adjust'];

type HomeScreenProps = {
  inventory: UseInventoryReturn;
  isOnline: boolean;
  onOpenStock: () => void;
};

/**
 * Início: a pessoa diz primeiro o que vai lançar e depois escolhe a vela ou o
 * insumo. As listas são só para escolher — tocar numa linha já abre o
 * formulário daquela ação. Ao terminar, dá para lançar outra igual sem voltar
 * ao começo, ou desfazer na hora.
 */
export function HomeScreen({ inventory, isOnline, onOpenStock }: HomeScreenProps) {
  const { products, supplies, recipes } = inventory;
  const [stack, setStack] = useState<Step[]>([{ kind: 'menu' }]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const step = stack[stack.length - 1];

  const goTo = (next: Step[]) => {
    setStack(next);
    setQuery('');
    setError(undefined);
  };
  const push = (next: Step) => goTo([...stack, next]);
  const back = () => goTo(stack.length > 1 ? stack.slice(0, -1) : stack);
  const home = () => goTo([{ kind: 'menu' }]);

  function start(action: Action) {
    if (action === 'sell' || action === 'produce') push({ kind: 'pickModel', action });
    else if (action === 'purchase') push({ kind: 'pickSupply', action });
    else push({ kind: 'adjustTarget' });
  }

  /** Para "Registrar outra": volta à lista de onde a vela ou o insumo saiu. */
  function pathBack(action: Action, movement: Movement): Step[] {
    const base: Step[] =
      action === 'adjust' ? [{ kind: 'menu' }, { kind: 'adjustTarget' }] : [{ kind: 'menu' }];
    const product = products.find((p) => p.id === movement.productId);
    if (product) {
      return [
        ...base,
        { kind: 'pickModel', action },
        { kind: 'pickProduct', action, model: product.model },
      ];
    }
    return [...base, { kind: 'pickSupply', action }];
  }

  async function run<T extends { ok: boolean }>(
    action: Action,
    operation: () => Promise<T>,
    onFailure: (result: T) => string,
  ) {
    setBusy(true);
    setError(undefined);
    try {
      const result = await operation();
      if (result.ok && 'movement' in result) {
        push({ kind: 'done', action, movement: result.movement as Movement, undone: false });
      } else {
        setError(onFailure(result));
      }
    } catch (cause) {
      // Sem este catch a falha virava promessa rejeitada e a tela ficava igual,
      // como se o botão não tivesse sido tocado.
      console.error('Falha ao registrar lançamento', cause);
      setError(failureMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function undo(movement: Movement) {
    setBusy(true);
    try {
      const result = await inventory.undo(movement.id);
      if (result.ok) {
        setStack((current) =>
          current.map((s, i) =>
            i === current.length - 1 && s.kind === 'done' ? { ...s, undone: true } : s,
          ),
        );
        setError(undefined);
      } else if (result.reason === 'negative_result') {
        setError('Não dá para desfazer: o estoque ficaria negativo. Essas velas já saíram?');
      } else {
        setError('Não foi possível desfazer este lançamento.');
      }
    } catch (cause) {
      console.error('Falha ao desfazer lançamento', cause);
      setError(failureMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  if (step.kind === 'menu') {
    const lowProducts = products.filter(isLowStock).length;
    const lowSupplies = supplies.filter(isLowStock).length;
    const recent = [...inventory.movements]
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, 5);
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">O que você vai lançar?</h1>
        {!isOnline && (
          <p className="text-sm text-taupe">Sem conexão: dá para consultar, mas não lançar.</p>
        )}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {TILE_ORDER.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => start(action)}
              disabled={!isOnline}
              className="flex min-h-32 flex-col items-start justify-between gap-3 rounded-2xl border border-taupe/20 bg-paper p-4 text-left shadow-sm hover:border-gold/60 disabled:opacity-50"
            >
              <span
                aria-hidden="true"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ACTIONS[action].tone}`}
              >
                <ActionIcon action={action} />
              </span>
              <span>
                <span className="block font-semibold">{ACTIONS[action].label}</span>
                <span className="block text-xs text-taupe">{ACTIONS[action].hint}</span>
              </span>
            </button>
          ))}
        </div>

        {lowProducts + lowSupplies > 0 && (
          <button
            type="button"
            onClick={onOpenStock}
            className="flex items-center justify-between rounded-lg bg-alert/10 px-3 py-2 text-left text-sm font-medium text-alert"
          >
            <span>
              {pluralize(lowProducts, 'vela', 'velas')} e{' '}
              {pluralize(lowSupplies, 'insumo', 'insumos')} com estoque baixo
            </span>
            <span aria-hidden="true">›</span>
          </button>
        )}

        <div>
          <h2 className="mb-2 font-sans text-xs font-semibold uppercase tracking-wider text-taupe">
            Últimos lançamentos
          </h2>
          <ul className="overflow-hidden rounded-lg border border-taupe/20 bg-paper">
            {recent.length === 0 && (
              <li className="p-3 text-sm text-taupe">
                Nada lançado ainda. Comece por um dos quadrados.
              </li>
            )}
            {recent.map((movement) => (
              <li
                key={movement.id}
                className="flex items-center justify-between gap-3 border-b border-taupe/20 px-3 py-2 text-sm last:border-b-0"
              >
                <span className={movement.undone ? 'text-taupe line-through' : ''}>
                  {MOVEMENT_LABELS[movement.type]} ·{' '}
                  {describeMovement(movement, products, supplies)}
                </span>
                <span className="shrink-0 text-xs text-taupe">
                  {movement.undone ? 'desfeito' : timeAgo(movement.occurredAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  if (step.kind === 'adjustTarget') {
    return (
      <FlowPage action="adjust" step="O que você vai ajustar?" onBack={back}>
        <div className="grid gap-3">
          <ChoiceCard
            title="Uma vela"
            meta="Quebrou, sumiu, deu de brinde, recontou"
            onClick={() => push({ kind: 'pickModel', action: 'adjust' })}
          />
          <ChoiceCard
            title="Um insumo"
            meta="Derramou essência, frasco trincado, recontagem"
            onClick={() => push({ kind: 'pickSupply', action: 'adjust' })}
          />
        </div>
      </FlowPage>
    );
  }

  if (step.kind === 'pickModel') {
    const found = query.trim()
      ? products.filter((p) => matchesQuery(productLabel(p), query)).sort(byScent)
      : [];
    return (
      <FlowPage
        action={step.action}
        step={step.action === 'produce' ? 'Qual recipiente vai produzir?' : 'De qual recipiente?'}
        onBack={back}
      >
        <SearchInput
          label="Buscar vela"
          placeholder="Atalho: ex. lavanda fosco"
          value={query}
          onChange={setQuery}
        />
        {query.trim() ? (
          <ProductList
            products={found}
            action={step.action}
            showModel
            recipes={recipes}
            supplies={supplies}
            query={query}
            onPick={(product) => push({ kind: 'form', action: step.action, productId: product.id })}
          />
        ) : (
          <div className="grid gap-3">
            {summarizeModels(products).map((summary) => (
              <ChoiceCard
                key={summary.model}
                title={summary.model}
                meta={`${formatModelPrice(summary)} · ${summary.units} un. em estoque`}
                warning={summary.lowCount > 0 ? `${summary.lowCount} com estoque baixo` : undefined}
                onClick={() =>
                  push({ kind: 'pickProduct', action: step.action, model: summary.model })
                }
              />
            ))}
          </div>
        )}
      </FlowPage>
    );
  }

  if (step.kind === 'pickProduct') {
    const inModel = products.filter((p) => p.model === step.model);
    const visible = inModel.filter((p) => matchesQuery(p.scent, query)).sort(byScent);
    return (
      <FlowPage action={step.action} step="Qual aroma?" onBack={back}>
        <div>
          <h2 className="font-display text-2xl font-semibold">{step.model}</h2>
          <p className="text-sm text-taupe">{pluralize(inModel.length, 'aroma', 'aromas')}</p>
        </div>
        <SearchInput
          label="Buscar aroma"
          placeholder="ex.: lavanda"
          value={query}
          onChange={setQuery}
        />
        <ProductList
          products={visible}
          action={step.action}
          recipes={recipes}
          supplies={supplies}
          query={query}
          onPick={(product) => push({ kind: 'form', action: step.action, productId: product.id })}
        />
      </FlowPage>
    );
  }

  if (step.kind === 'pickSupply') {
    const visible = supplies.filter((s) => matchesQuery(s.name, query)).sort(byName);
    return (
      <FlowPage
        action={step.action}
        step={step.action === 'purchase' ? 'O que chegou?' : 'Qual insumo?'}
        onBack={back}
      >
        <SearchInput
          label="Buscar insumo"
          placeholder="ex.: cera, lavanda, frasco"
          value={query}
          onChange={setQuery}
        />
        {visible.length === 0 ? (
          <p className="text-sm text-taupe">Nenhum insumo encontrado para “{query.trim()}”.</p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-taupe/20 bg-paper">
            {visible.map((supply) => (
              <li key={supply.id} className="border-b border-taupe/20 last:border-b-0">
                <button
                  type="button"
                  onClick={() => push({ kind: 'form', action: step.action, supplyId: supply.id })}
                  className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-cream"
                >
                  <span className="font-medium">{supply.name}</span>
                  <span
                    className={`shrink-0 text-sm tabular-nums ${isLowStock(supply) ? 'font-semibold text-alert' : ''}`}
                  >
                    {formatQuantity(supply.quantity)} {supply.unit}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </FlowPage>
    );
  }

  if (step.kind === 'form') {
    const product = products.find((p) => p.id === step.productId);
    const supply = supplies.find((s) => s.id === step.supplyId);
    const title = product ? product.scent : (supply?.name ?? '');
    const subtitle = product ? `${product.model} · ${formatBRL(product.priceCents)}` : undefined;
    return (
      <FlowPage action={step.action} step="Confira e registre" onBack={back}>
        <div>
          <h2 className="font-display text-2xl font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-taupe">{subtitle}</p>}
        </div>
        <div className="rounded-lg border border-taupe/20 bg-paper p-4">
          {step.action === 'sell' && product && (
            <SellForm
              product={product}
              error={error}
              onCancel={back}
              onSubmit={(values) =>
                !busy &&
                run(
                  'sell',
                  () => inventory.sell({ productId: product.id, ...values }),
                  (r) =>
                    'reason' in r && r.reason === 'insufficient_stock'
                      ? `Estoque insuficiente: há ${r.available}, pedido de ${r.requested}.`
                      : 'Não foi possível registrar a venda.',
                )
              }
            />
          )}
          {step.action === 'produce' && product && (
            <ProduceForm
              product={product}
              error={error}
              onCancel={back}
              onSubmit={(values) =>
                !busy &&
                run(
                  'produce',
                  () => inventory.produce({ productId: product.id, ...values }),
                  (r) =>
                    'reason' in r && r.reason === 'missing_supplies'
                      ? `Insumo insuficiente:\n${r.missing
                          .map((m) => {
                            const s = supplies.find((x) => x.id === m.supplyId);
                            return `${s?.name ?? m.supplyId}: faltam ${formatQuantity(m.required - m.available)} ${s?.unit ?? ''}`;
                          })
                          .join('\n')}`
                      : 'Não foi possível registrar a produção.',
                )
              }
            />
          )}
          {step.action === 'purchase' && supply && (
            <>
              <PurchaseForm
                supply={supply}
                onCancel={back}
                onSubmit={(values) =>
                  !busy &&
                  run(
                    'purchase',
                    () => inventory.purchaseSupply({ supplyId: supply.id, ...values }),
                    () => 'Não foi possível registrar a entrada.',
                  )
                }
              />
              {error && (
                <p role="alert" className="mt-3 text-sm text-alert">
                  {error}
                </p>
              )}
            </>
          )}
          {step.action === 'adjust' && (product || supply) && (
            <AdjustForm
              reasons={product ? PRODUCT_ADJUST_REASONS : SUPPLY_ADJUST_REASONS}
              currentLabel={
                product
                  ? `Em estoque: ${product.quantity} un.`
                  : `Em estoque: ${formatQuantity(supply!.quantity)} ${supply!.unit}.`
              }
              error={error}
              onCancel={back}
              onSubmit={(values) =>
                !busy &&
                run(
                  'adjust',
                  () =>
                    inventory.adjust({
                      target: product ? 'product' : 'supply',
                      id: (product ?? supply)!.id,
                      ...values,
                    }),
                  (r) =>
                    'reason' in r && r.reason === 'negative_result'
                      ? `O ajuste deixaria o estoque negativo (${r.resulting}).`
                      : 'Não foi possível registrar o ajuste.',
                )
              }
            />
          )}
        </div>
      </FlowPage>
    );
  }

  // step.kind === 'done'
  const { movement, action, undone } = step;
  const texts = ACTIONS[action];
  const product = products.find((p) => p.id === movement.productId);
  const supply = supplies.find((s) => s.id === movement.supplyId);
  const now = product
    ? `Agora tem ${product.quantity} un. dessa vela.`
    : supply
      ? `Agora tem ${formatQuantity(supply.quantity)} ${supply.unit} de ${supply.name.toLowerCase()}.`
      : '';
  return (
    <section className="mx-auto flex max-w-md flex-col items-stretch gap-5 py-6 text-center">
      <span
        aria-hidden="true"
        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ${texts.tone}`}
      >
        {undone ? '↺' : '✓'}
      </span>
      <div>
        <h1 className="text-3xl font-semibold">{undone ? texts.undone : texts.done}</h1>
        <p className="mt-1 text-sm text-taupe">
          {describeMovement(movement, products, supplies)}
          {movement.totalCents !== undefined && ` · ${formatBRL(movement.totalCents)}`}
        </p>
        <p className="mt-1 text-sm text-taupe">{now}</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-alert">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => goTo(pathBack(action, movement))}
          className={`rounded-lg px-4 py-3 font-semibold text-paper ${texts.solid}`}
        >
          {texts.again}
        </button>
        <button
          type="button"
          onClick={home}
          className="rounded-lg border border-taupe/30 bg-paper px-4 py-3 font-semibold"
        >
          Voltar ao início
        </button>
        {!undone && (
          <button
            type="button"
            onClick={() => undo(movement)}
            disabled={busy || !isOnline}
            className="px-4 py-2 text-sm font-medium text-taupe underline underline-offset-4 disabled:opacity-50"
          >
            Desfazer este lançamento
          </button>
        )}
      </div>
    </section>
  );
}

function FlowPage({
  action,
  step,
  onBack,
  children,
}: {
  action: Action;
  step: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 self-start rounded-md px-2 py-1 text-sm font-medium text-taupe hover:bg-paper"
      >
        ‹ Voltar
      </button>
      <p className="flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${ACTIONS[action].tone}`}
        >
          {ACTIONS[action].tag}
        </span>
        <span className="text-sm text-taupe">{step}</span>
      </p>
      {children}
    </section>
  );
}

function ChoiceCard({
  title,
  meta,
  warning,
  onClick,
}: {
  title: string;
  meta: string;
  warning?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-taupe/20 bg-paper p-4 text-left shadow-sm hover:border-gold/60"
    >
      <span>
        <span className="block font-display text-xl font-semibold">{title}</span>
        <span className="block text-sm text-taupe">{meta}</span>
        {warning && <span className="block text-sm text-alert">{warning}</span>}
      </span>
      <span aria-hidden="true" className="text-2xl text-taupe">
        ›
      </span>
    </button>
  );
}

function SearchInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="search"
      aria-label={label}
      className={inputClassName}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
    />
  );
}

/** Linhas de vela que se adaptam à ação: sem estoque não vende; falta insumo avisa. */
function ProductList({
  products,
  action,
  showModel = false,
  recipes,
  supplies,
  query,
  onPick,
}: {
  products: Product[];
  action: Action;
  showModel?: boolean;
  recipes: UseInventoryReturn['recipes'];
  supplies: Supply[];
  query: string;
  onPick: (product: Product) => void;
}) {
  if (products.length === 0) {
    return <p className="text-sm text-taupe">Nenhuma vela encontrada para “{query.trim()}”.</p>;
  }
  return (
    <ul className="overflow-hidden rounded-lg border border-taupe/20 bg-paper">
      {products.map((product) => {
        const cannotSell = action === 'sell' && product.quantity === 0;
        const missing =
          action === 'produce' ? missingForProduction(product, 1, recipes, supplies) : [];
        const note = cannotSell
          ? 'Sem estoque para vender'
          : missing.length > 0
            ? `Falta ${missing.map((s) => s.name.toLowerCase()).join(', ')}`
            : showModel
              ? product.model
              : undefined;
        return (
          <li key={product.id} className="border-b border-taupe/20 last:border-b-0">
            <button
              type="button"
              onClick={() => onPick(product)}
              disabled={cannotSell}
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-cream disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <span className="min-w-0">
                <span className="block font-medium">{product.scent}</span>
                {note && (
                  <span
                    className={`block text-xs ${missing.length > 0 ? 'text-alert' : 'text-taupe'}`}
                  >
                    {note}
                  </span>
                )}
              </span>
              <span
                className={`shrink-0 text-sm tabular-nums ${isLowStock(product) ? 'font-semibold text-alert' : ''}`}
              >
                {product.quantity} un.
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ActionIcon({ action }: { action: Action }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (action === 'sell') {
    return (
      <svg {...common}>
        <path d="M6 8h12l-1 12H7L6 8z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
    );
  }
  if (action === 'produce') {
    return (
      <svg {...common}>
        <path d="M12 3c1.8 2 2.6 3.4 2.6 4.6A2.6 2.6 0 0 1 12 10.2a2.6 2.6 0 0 1-2.6-2.6C9.4 6.4 10.2 5 12 3z" />
        <rect x="7" y="12" width="10" height="9" rx="1.5" />
      </svg>
    );
  }
  if (action === 'purchase') {
    return (
      <svg {...common}>
        <path d="M4 9l8-5 8 5v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9z" />
        <path d="M12 10v7" />
        <path d="M9 14l3 3 3-3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M5 7h9M18 7h1M5 17h1M10 17h9" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </svg>
  );
}

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 24 * 60) return `há ${Math.floor(minutes / 60)} h`;
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })
    .format(new Date(iso))
    .replace('.', '');
}
