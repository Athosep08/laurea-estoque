import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Supply } from '../../domain/models';
import { formatBRL, parseReaisInput } from '../../domain/money';
import { formatQuantity } from '../../domain/quantity';
import { Field, inputClassName } from './Field';

type PurchaseFormProps = {
  supply: Supply;
  onSubmit: (values: { quantity: number; totalCents?: number; note?: string }) => void;
  onCancel: () => void;
};

/** Grama e mililitro dão custos minúsculos (R$ 0,18 por g); por kg e por L se lê melhor. */
function unitCostLabel(totalCents: number, quantity: number, unit: Supply['unit']): string {
  if (unit === 'g') return `${formatBRL(Math.round((totalCents / quantity) * 1000))} por kg`;
  if (unit === 'ml') return `${formatBRL(Math.round((totalCents / quantity) * 1000))} por L`;
  return `${formatBRL(Math.round(totalCents / quantity))} por ${unit}`;
}

export function PurchaseForm({ supply, onSubmit, onCancel }: PurchaseFormProps) {
  const [quantity, setQuantity] = useState(0);
  const [paid, setPaid] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();

  const paidCents = parseReaisInput(paid);
  const unitCost =
    paidCents !== undefined && paidCents > 0 && quantity > 0
      ? unitCostLabel(paidCents, quantity, supply.unit)
      : undefined;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!(quantity > 0)) {
      setError('Informe uma quantidade maior que zero.');
      return;
    }
    if (Number.isNaN(paidCents)) {
      setError('Valor pago inválido. Use só números, ex.: 180,00.');
      return;
    }
    setError(undefined);
    onSubmit({ quantity, totalCents: paidCents, note: note.trim() || undefined });
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

      <Field label="Valor pago (R$, opcional)" htmlFor="purchase-paid">
        <input
          id="purchase-paid"
          inputMode="decimal"
          autoComplete="off"
          className={inputClassName}
          value={paid}
          onChange={(e) => setPaid(e.target.value)}
          placeholder="ex.: 180,00"
          aria-describedby="purchase-paid-hint"
        />
        <p id="purchase-paid-hint" className="mt-1 text-xs text-taupe">
          {unitCost
            ? `Sai a ${unitCost}.`
            : 'É daqui que sai o relatório de gastos. Deixe vazio se foi brinde.'}
        </p>
      </Field>

      <Field label="Observação (opcional)" htmlFor="purchase-note">
        <input
          id="purchase-note"
          className={inputClassName}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Fornecedor, nota fiscal..."
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
