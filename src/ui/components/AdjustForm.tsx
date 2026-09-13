import { useState } from 'react';
import type { FormEvent } from 'react';
import { Field, inputClassName } from './Field';

type AdjustFormProps = {
  currentLabel: string;
  /**
   * Motivos mais comuns, em botões. Escolher um preenche o campo — o texto
   * livre continua valendo. Motivo padronizado é o que permite ao relatório
   * de Saídas somar "Brinde" com "Brinde", em vez de "brinde", "Brinde " etc.
   */
  reasons?: string[];
  error?: string;
  onSubmit: (values: { delta: number; note: string }) => void;
  onCancel: () => void;
};

export function AdjustForm({
  currentLabel,
  reasons = [],
  error,
  onSubmit,
  onCancel,
}: AdjustFormProps) {
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
        {reasons.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Motivos comuns">
            {reasons.map((reason) => (
              <button
                key={reason}
                type="button"
                aria-pressed={note === reason}
                onClick={() => setNote(reason)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  note === reason
                    ? 'border-ink bg-ink text-paper'
                    : 'border-taupe/30 bg-paper text-ink hover:border-taupe/60'
                }`}
              >
                {reason}
              </button>
            ))}
          </div>
        )}
        <input
          id="adjust-note"
          className={inputClassName}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            reasons.length ? 'Ou escreva outro motivo' : 'Quebra no transporte, recontagem...'
          }
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
