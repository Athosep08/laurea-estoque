import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Product, Recipe, RecipeItem, Supply } from '../../domain/models';
import { centsToReais, reaisToCents } from '../../domain/money';
import { Field, inputClassName } from './Field';

export type ProductFormValues = {
  model: string;
  scent: string;
  priceReais: string;
  quantity: number;
  minQuantity: number;
  active: boolean;
  recipeItems: RecipeItem[];
};

export type ProductFormResult = {
  model: string;
  scent: string;
  priceCents: number;
  quantity: number;
  minQuantity: number;
  active: boolean;
  recipeItems: RecipeItem[];
};

type ProductFormProps = {
  product?: Product;
  recipe?: Recipe;
  supplies: Supply[];
  onSubmit: (values: ProductFormResult) => void;
  onCancel: () => void;
};

export function ProductForm({ product, recipe, supplies, onSubmit, onCancel }: ProductFormProps) {
  const [model, setModel] = useState(product?.model ?? '');
  const [scent, setScent] = useState(product?.scent ?? '');
  const [priceReais, setPriceReais] = useState(
    product ? centsToReais(product.priceCents).toFixed(2) : '',
  );
  const [quantity, setQuantity] = useState(product?.quantity ?? 0);
  const [minQuantity, setMinQuantity] = useState(product?.minQuantity ?? 0);
  const [active, setActive] = useState(product?.active ?? true);
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>(recipe?.items ?? []);
  const [error, setError] = useState<string | undefined>();

  const isEditing = Boolean(product);

  function addRecipeRow() {
    if (supplies.length === 0) return;
    setRecipeItems((items) => [...items, { supplyId: supplies[0].id, quantityPerUnit: 0 }]);
  }

  function updateRecipeRow(index: number, patch: Partial<RecipeItem>) {
    setRecipeItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeRecipeRow(index: number) {
    setRecipeItems((items) => items.filter((_, i) => i !== index));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);

    if (!model.trim() || !scent.trim()) {
      setError('Preencha modelo e aroma.');
      return;
    }
    const priceCents = reaisToCents(Number(priceReais.replace(',', '.')));
    if (!Number.isFinite(priceCents) || priceCents <= 0) {
      setError('Informe um preço válido.');
      return;
    }
    if (!isEditing && (!Number.isInteger(quantity) || quantity < 0)) {
      setError('Quantidade inicial deve ser um inteiro maior ou igual a zero.');
      return;
    }
    if (!Number.isInteger(minQuantity) || minQuantity < 0) {
      setError('Estoque mínimo deve ser um inteiro maior ou igual a zero.');
      return;
    }

    onSubmit({
      model: model.trim(),
      scent: scent.trim(),
      priceCents,
      quantity,
      minQuantity,
      active,
      recipeItems,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Field label="Modelo" htmlFor="product-model">
        <input
          id="product-model"
          className={inputClassName}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Clássica Liso 90g"
          required
        />
      </Field>

      <Field label="Aroma" htmlFor="product-scent">
        <input
          id="product-scent"
          className={inputClassName}
          value={scent}
          onChange={(e) => setScent(e.target.value)}
          placeholder="Lavanda"
          required
        />
      </Field>

      <Field label="Preço (R$)" htmlFor="product-price">
        <input
          id="product-price"
          type="number"
          step="0.01"
          min="0"
          className={inputClassName}
          value={priceReais}
          onChange={(e) => setPriceReais(e.target.value)}
          required
        />
      </Field>

      {!isEditing && (
        <Field label="Quantidade inicial" htmlFor="product-quantity">
          <input
            id="product-quantity"
            type="number"
            step="1"
            min="0"
            className={inputClassName}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </Field>
      )}

      <Field label="Estoque mínimo (alerta)" htmlFor="product-min-quantity">
        <input
          id="product-min-quantity"
          type="number"
          step="1"
          min="0"
          className={inputClassName}
          value={minQuantity}
          onChange={(e) => setMinQuantity(Number(e.target.value))}
        />
      </Field>

      <label className="mb-4 flex items-center gap-2 text-sm font-medium text-taupe">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-5 w-5"
        />
        Ativo (aparece na lista de venda)
      </label>

      <fieldset className="mb-4 rounded-md border border-taupe/30 p-3">
        <legend className="px-1 text-sm font-medium text-taupe">
          Ficha técnica (opcional — baixa insumos automaticamente ao produzir)
        </legend>

        {supplies.length === 0 ? (
          <p className="text-sm text-taupe">Cadastre insumos antes de montar uma ficha técnica.</p>
        ) : (
          <>
            {recipeItems.map((item, index) => (
              <div key={index} className="mb-2 flex items-center gap-2">
                <select
                  aria-label="Insumo"
                  className={inputClassName}
                  value={item.supplyId}
                  onChange={(e) => updateRecipeRow(index, { supplyId: e.target.value })}
                >
                  {supplies.map((supply) => (
                    <option key={supply.id} value={supply.id}>
                      {supply.name} ({supply.unit})
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Quantidade por unidade"
                  type="number"
                  step="any"
                  min="0"
                  className={`${inputClassName} w-28`}
                  value={item.quantityPerUnit}
                  onChange={(e) =>
                    updateRecipeRow(index, { quantityPerUnit: Number(e.target.value) })
                  }
                />
                <button
                  type="button"
                  onClick={() => removeRecipeRow(index)}
                  aria-label="Remover insumo"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-alert hover:bg-alert/10"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addRecipeRow}
              className="text-sm font-medium text-gold hover:underline"
            >
              + adicionar insumo
            </button>
          </>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="mb-4 text-sm text-alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-4 py-2 font-medium text-taupe hover:bg-cream"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-md bg-ink px-4 py-2 font-medium text-paper hover:bg-ink/90"
        >
          Salvar
        </button>
      </div>
    </form>
  );
}
