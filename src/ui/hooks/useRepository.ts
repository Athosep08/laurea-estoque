import { useMemo } from 'react';
import type { EstoqueRepository } from '../../infra/storage/EstoqueRepository';
import { SupabaseEstoqueRepository } from '../../infra/storage/SupabaseEstoqueRepository';
import { supabase } from '../../infra/storage/supabaseClient';

/**
 * Ponto único de acoplamento da UI ao adapter concreto. A troca de
 * `LocalStorageRepository` para `SupabaseEstoqueRepository` aconteceu só
 * aqui — nem `domain/`, nem `application/`, nem os componentes de tela
 * mudaram uma linha por causa disso.
 */
export function useRepository(): EstoqueRepository {
  return useMemo(() => new SupabaseEstoqueRepository(supabase), []);
}
