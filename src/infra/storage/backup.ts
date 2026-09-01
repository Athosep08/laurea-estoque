import type { EstoqueRepository } from './EstoqueRepository';
import { migrate, toPersisted } from './schema';

export async function exportBackup(repository: EstoqueRepository): Promise<string> {
  return JSON.stringify(toPersisted(await repository.getState()), null, 2);
}

export type ImportBackupResult = { ok: true } | { ok: false; reason: 'invalid_json' };

export async function importBackup(
  repository: EstoqueRepository,
  json: string,
): Promise<ImportBackupResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
  await repository.replaceState(migrate(parsed));
  return { ok: true };
}

export async function eraseAll(repository: EstoqueRepository): Promise<void> {
  await repository.eraseAll();
}
