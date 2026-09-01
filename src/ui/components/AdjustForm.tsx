import { useState } from 'react';
import type { FormEvent } from 'react';
import { Field, inputClassName } from './Field';

type AdjustFormProps = {
  currentLabel: string;
  error?: string;
  onSubmit: (values: { delta: number; note: string }) => void;
  onCancel: () => void;
};

export function AdjustForm({ currentLabel, error, onSubmit, onCancel }: AdjustFormProps) {
  const [delta, setDelta] = useState(0);
  const [note, setNote] = useState('');
  const [localError, setLocalError] = useState<string | undefined>();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!note.trim()) {
      setLocalError('Explique o motivo do ajuste.');
      return;
    }
    setLocalError(undefined);
    onSubmit({ delta, note: note.trim() });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p className="mb-4 text-sm text-taupe">{currentLabel}</p>

      <Field label="Ajuste (use negativo para quebra/perda)" htmlFor="adjust-delta">
        <input
          id="adjust-delta"
          type="number"
          step="any"
          className={inputClassName}
          value={delta}
          onChange={(e) => setDelta(Number(e.target.value))}
          required
        />
      </Field>

      <Field label="Motivo" htmlFor="adjust-note">
        <input
          id="adjust-note"
          className={inputClassName}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Quebra no transporte, recontagem..."
          required
        />
      </Field>

      {(localError || error) && (
        <p role="alert" className="mb-4 text-sm text-alert">
          {localError ?? error}
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
          Registrar ajuste
        </button>
      </div>
    </form>
  );
}
