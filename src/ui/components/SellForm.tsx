import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Product } from '../../domain/models';
import { centsToReais, multiplyCents, reaisToCents } from '../../domain/money';
import { Field, inputClassName } from './Field';

type SellFormProps = {
  product: Product;
  error?: string;
  onSubmit: (values: { quantity: number; totalCents: number; note?: string }) => void;
  onCancel: () => void;
};

export function SellForm({ product, error, onSubmit, onCancel }: SellFormProps) {
  const [quantity, setQuantity] = useState(1);
  const [totalReais, setTotalReais] = useState(centsToReais(product.priceCents).toFixed(2));
  const [note, setNote] = useState('');
  const [touchedTotal, setTouchedTotal] = useState(false);

  function handleQuantityChange(value: number) {
    setQuantity(value);
    if (!touchedTotal) {
      setTotalReais(centsToReais(multiplyCents(product.priceCents, value)).toFixed(2));
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({
      quantity,
      totalCents: reaisToCents(Number(totalReais.replace(',', '.'))),
      note: note.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p className="mb-4 text-sm text-taupe">
        {product.model} — {product.scent}. Em estoque: {product.quantity}.
      </p>

      <Field label="Quantidade vendida" htmlFor="sell-quantity">
        <input
          id="sell-quantity"
          type="number"
          min="1"
          step="1"
          className={inputClassName}
          value={quantity}
          onChange={(e) => handleQuantityChange(Number(e.target.value))}
          required
        />
      </Field>

      <Field label="Total (R$)" htmlFor="sell-total">
        <input
          id="sell-total"
          type="number"
          min="0"
          step="0.01"
          className={inputClassName}
          value={totalReais}
          onChange={(e) => {
            setTouchedTotal(true);
            setTotalReais(e.target.value);
          }}
          required
        />
      </Field>

      <Field label="Observação (opcional)" htmlFor="sell-note">
        <input
          id="sell-note"
          className={inputClassName}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Pedido exclusivo, desconto..."
        />
      </Field>

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
          className="rounded-md bg-ok px-4 py-2 font-medium text-paper hover:bg-ok/90"
        >
          Registrar venda
        </button>
      </div>
    </form>
  );
}
