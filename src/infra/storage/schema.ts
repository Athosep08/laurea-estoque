import type { EstoqueState } from './EstoqueRepository';

/**
 * Versão do formato salvo em disco (localStorage hoje, potencialmente outro
 * backend amanhã). Suba este número e adicione um passo de migração sempre
 * que o formato mudar — nunca leia dados antigos como se fossem o formato
 * novo sem passar por `migrate`.
 */
export const SCHEMA_VERSION = 1;

export type PersistedEstoqueState = EstoqueState & { schemaVersion: number };

export function createEmptyState(): PersistedEstoqueState {
  return {
    schemaVersion: SCHEMA_VERSION,
    products: [],
    supplies: [],
    recipes: [],
    movements: [],
  };
}

export function toPersisted(state: EstoqueState): PersistedEstoqueState {
  return { schemaVersion: SCHEMA_VERSION, ...state };
}

/**
 * Normaliza dados vindos de disco (localStorage ou arquivo de backup) para o
 * formato atual. Hoje só existe a v1, então isto é essencialmente uma
 * validação defensiva; migrações futuras (v1 -> v2 -> ...) entram aqui como
 * passos incrementais, um por vez.
 */
export function migrate(data: unknown): PersistedEstoqueState {
  if (!data || typeof data !== 'object') {
    return createEmptyState();
  }
  const candidate = data as Partial<PersistedEstoqueState>;
  return {
    schemaVersion: SCHEMA_VERSION,
    products: Array.isArray(candidate.products) ? candidate.products : [],
    supplies: Array.isArray(candidate.supplies) ? candidate.supplies : [],
    recipes: Array.isArray(candidate.recipes) ? candidate.recipes : [],
    movements: Array.isArray(candidate.movements) ? candidate.movements : [],
  };
}
