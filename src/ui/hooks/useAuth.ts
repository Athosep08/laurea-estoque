import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../infra/storage/supabaseClient';

export type SignInResult = { ok: true } | { ok: false; message: string };

/**
 * Login compartilhado: um único e-mail/senha usado por todos os
 * dispositivos (não há cadastro nem contas por usuário). Este hook só
 * expõe a sessão atual do Supabase Auth e as ações de entrar/sair — quem
 * decide se mostra a tela de login ou o app é o `App.tsx`.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<SignInResult> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { ok: false, message: error.message } : { ok: true };
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  return { session, loading, signIn, signOut };
}
