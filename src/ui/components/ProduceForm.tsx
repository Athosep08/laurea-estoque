import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Product } from '../../domain/models';
import { Field, inputClassName } from './Field';

type ProduceFormProps = {
  product: Product;
  error?: string;
  onSubmit: (values: { quantity: number; note?: string }) => void;
  onCancel: () => void;
};

export function ProduceForm({ product, error, onSubmit, onCancel }: ProduceFormProps) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ quantity, note: note.trim() || undefined });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p className="mb-4 text-sm text-taupe">
        {product.model} — {product.scent}. Em estoque: {product.quantity}.
        {product.recipeId
          ? ' Consome insumos pela ficha técnica.'
          : ' Sem ficha técnica associada.'}
      </p>

      <Field label="Quantidade produzida" htmlFor="produce-quantity">
        <input
          id="produce-quantity"
          type="number"
          min="1"
          step="1"
          className={inputClassName}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          required
        />
      </Field>

      <Field label="Observação (opcional)" htmlFor="produce-note">
        <input
          id="produce-note"
          className={inputClassName}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      {error && (
        <p role="alert" className="mb-4 whitespace-pre-line text-sm text-alert">
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
          className="rounded-md bg-gold px-4 py-2 font-medium text-paper hover:bg-gold/90"
        >
          Registrar produção
        </button>
      </div>
    </form>
  );
}
