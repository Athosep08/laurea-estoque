import { useState, type FormEvent } from 'react';
import type { SignInResult } from '../hooks/useAuth';

type LoginScreenProps = {
  onSubmit: (email: string, password: string) => Promise<SignInResult>;
};

export function LoginScreen({ onSubmit }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(undefined);
    const result = await onSubmit(email, password);
    setSubmitting(false);
    if (!result.ok) {
      setError('E-mail ou senha inválidos.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-taupe/20 bg-paper p-6 shadow-sm"
      >
        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">L&apos;AUREA</h1>
        <p className="mb-5 text-sm text-taupe">Entre para acessar o estoque.</p>

        <label className="mb-3 block text-sm font-medium text-taupe">
          E-mail
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-taupe/40 bg-paper px-3 py-2 text-ink"
          />
        </label>

        <label className="mb-4 block text-sm font-medium text-taupe">
          Senha
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-taupe/40 bg-paper px-3 py-2 text-ink"
          />
        </label>

        {error && (
          <p role="alert" className="mb-4 text-sm text-alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-ink px-4 py-2 font-medium text-paper hover:bg-ink/90 disabled:opacity-50"
        >
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
