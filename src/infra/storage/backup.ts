import type { EstoqueRepository } from './EstoqueRepository';
import { migrate, toPersisted } from './schema';

export function exportBackup(repository: EstoqueRepository): string {
  return JSON.stringify(toPersisted(repository.getState()), null, 2);
}

export type ImportBackupResult = { ok: true } | { ok: false; reason: 'invalid_json' };

export function importBackup(repository: EstoqueRepository, json: string): ImportBackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
  repository.replaceState(migrate(parsed));
  return { ok: true };
}

export function eraseAll(repository: EstoqueRepository): void {
  repository.replaceState({ products: [], supplies: [], recipes: [], movements: [] });
}
