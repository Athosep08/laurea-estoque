import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

type DialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Wrapper fino sobre <dialog> nativo: Esc para fechar e devolução de foco ao
 * elemento que abriu o diálogo já vêm de graça do navegador — não precisamos
 * reimplementar focus trap nem listener de teclado.
 */
export function Dialog({ open, title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
      className="w-[calc(100%-2rem)] max-w-md rounded-lg border border-taupe/30 bg-paper p-0 text-ink shadow-xl backdrop:bg-transparent"
    >
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id={titleId} className="font-display text-xl font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-taupe hover:bg-cream"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
