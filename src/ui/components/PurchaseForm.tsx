import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Supply } from '../../domain/models';
import { formatQuantity } from '../../domain/quantity';
import { Field, inputClassName } from './Field';

type PurchaseFormProps = {
  supply: Supply;
  onSubmit: (values: { quantity: number; note?: string }) => void;
  onCancel: () => void;
};

export function PurchaseForm({ supply, onSubmit, onCancel }: PurchaseFormProps) {
  const [quantity, setQuantity] = useState(0);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!(quantity > 0)) {
      setError('Informe uma quantidade maior que zero.');
      return;
    }
    setError(undefined);
    onSubmit({ quantity, note: note.trim() || undefined });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p className="mb-4 text-sm text-taupe">
        {supply.name}. Em estoque: {formatQuantity(supply.quantity)} {supply.unit}.
      </p>

      <Field label={`Quantidade comprada (${supply.unit})`} htmlFor="purchase-quantity">
        <input
          id="purchase-quantity"
          type="number"
          min="0"
          step="any"
          className={inputClassName}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          required
        />
      </Field>

      <Field label="Observação (opcional)" htmlFor="purchase-note">
        <input
          id="purchase-note"
          className={inputClassName}
          value={note}
          onChange={(e) => setNote(e.target.value)}
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
          Registrar compra
        </button>
      </div>
    </form>
  );
}
