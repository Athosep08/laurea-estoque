import { useMemo } from 'react';
import type { EstoqueRepository } from '../../infra/storage/EstoqueRepository';
import { LocalStorageRepository } from '../../infra/storage/LocalStorageRepository';

/**
 * Ponto único de acoplamento da UI ao adapter concreto. Se um dia trocarmos
 * localStorage por Supabase, é aqui — e só aqui — que a troca acontece.
 */
export function useRepository(): EstoqueRepository {
  return useMemo(() => new LocalStorageRepository(), []);
}
