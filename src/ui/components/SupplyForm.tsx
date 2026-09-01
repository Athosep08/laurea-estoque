import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Supply, SupplyUnit } from '../../domain/models';
import { Field, inputClassName } from './Field';

const UNITS: SupplyUnit[] = ['kg', 'g', 'L', 'ml', 'un'];

export type SupplyFormResult = {
  name: string;
  unit: SupplyUnit;
  quantity: number;
  minQuantity: number;
};

type SupplyFormProps = {
  supply?: Supply;
  onSubmit: (values: SupplyFormResult) => void;
  onCancel: () => void;
};

export function SupplyForm({ supply, onSubmit, onCancel }: SupplyFormProps) {
  const [name, setName] = useState(supply?.name ?? '');
  const [unit, setUnit] = useState<SupplyUnit>(supply?.unit ?? 'kg');
  const [quantity, setQuantity] = useState(supply?.quantity ?? 0);
  const [minQuantity, setMinQuantity] = useState(supply?.minQuantity ?? 0);
  const [error, setError] = useState<string | undefined>();

  const isEditing = Boolean(supply);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome do insumo.');
      return;
    }
    if (minQuantity < 0 || (!isEditing && quantity < 0)) {
      setError('Quantidades não podem ser negativas.');
      return;
    }
    setError(undefined);
    onSubmit({ name: name.trim(), unit, quantity, minQuantity });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Field label="Nome" htmlFor="supply-name">
        <input
          id="supply-name"
          className={inputClassName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Cera vegetal"
          required
        />
      </Field>

      <Field label="Unidade" htmlFor="supply-unit">
        <select
          id="supply-unit"
          className={inputClassName}
          value={unit}
          onChange={(e) => setUnit(e.target.value as SupplyUnit)}
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </Field>

      {!isEditing && (
        <Field label="Quantidade inicial" htmlFor="supply-quantity">
          <input
            id="supply-quantity"
            type="number"
            step="any"
            min="0"
            className={inputClassName}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </Field>
      )}

      <Field label="Estoque mínimo (alerta)" htmlFor="supply-min-quantity">
        <input
          id="supply-min-quantity"
          type="number"
          step="any"
          min="0"
          className={inputClassName}
          value={minQuantity}
          onChange={(e) => setMinQuantity(Number(e.target.value))}
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
          className="rounded-md bg-ink px-4 py-2 font-medium text-paper hover:bg-ink/90"
        >
          Salvar
        </button>
      </div>
    </form>
  );
}
