import type { ReactNode } from 'react';

type FieldProps = {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
};

export const inputClassName =
  'w-full rounded-md border border-taupe/40 bg-paper px-3 py-2 text-ink focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold-lt/50';

export function Field({ label, htmlFor, error, children }: FieldProps) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-taupe">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-sm text-alert">
          {error}
        </p>
      )}
    </div>
  );
}
