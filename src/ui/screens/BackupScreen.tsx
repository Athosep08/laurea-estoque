import { useRef, useState } from 'react';
import { eraseAll, exportBackup, importBackup } from '../../infra/storage/backup';
import type { EstoqueRepository } from '../../infra/storage/EstoqueRepository';
import type { UseInventoryReturn } from '../hooks/useInventory';

type BackupScreenProps = {
  repository: EstoqueRepository;
  inventory: UseInventoryReturn;
};

export function BackupScreen({ repository, inventory }: BackupScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | undefined>();

  function handleExport() {
    const json = exportBackup(repository);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `laurea-estoque-backup-${stamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File) {
    const text = await file.text();
    const result = importBackup(repository, text);
    if (result.ok) {
      inventory.reload();
      setMessage('Backup importado com sucesso.');
    } else {
      setMessage('Não foi possível importar: arquivo inválido.');
    }
  }

  function handleEraseAll() {
    if (
      !window.confirm(
        'Apagar TODOS os dados (velas, insumos e histórico)? Esta ação não pode ser desfeita.',
      )
    ) {
      return;
    }
    eraseAll(repository);
    inventory.reload();
    setMessage('Todos os dados foram apagados.');
  }

  return (
    <section className="max-w-xl">
      <h1 className="mb-4 text-2xl font-semibold">Backup</h1>

      <div className="mb-6 rounded-lg border border-taupe/20 bg-paper p-4">
        <h2 className="mb-2 font-medium">Exportar</h2>
        <p className="mb-3 text-sm text-taupe">
          Baixa um arquivo JSON com todas as velas, insumos e o histórico de movimentos.
        </p>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-md bg-ink px-4 py-2 font-medium text-paper hover:bg-ink/90"
        >
          Exportar backup
        </button>
      </div>

      <div className="mb-6 rounded-lg border border-taupe/20 bg-paper p-4">
        <h2 className="mb-2 font-medium">Importar</h2>
        <p className="mb-3 text-sm text-taupe">
          Substitui os dados atuais pelo conteúdo de um arquivo de backup exportado antes.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImportFile(file);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md border border-taupe/40 px-4 py-2 font-medium text-ink hover:bg-cream"
        >
          Escolher arquivo...
        </button>
      </div>

      <div className="mb-6 rounded-lg border border-alert/30 bg-paper p-4">
        <h2 className="mb-2 font-medium text-alert">Apagar tudo</h2>
        <p className="mb-3 text-sm text-taupe">
          Remove permanentemente todas as velas, insumos e o histórico. Exporte um backup antes.
        </p>
        <button
          type="button"
          onClick={handleEraseAll}
          className="rounded-md bg-alert px-4 py-2 font-medium text-paper hover:bg-alert/90"
        >
          Apagar tudo
        </button>
      </div>

      {message && (
        <p role="status" className="text-sm text-ok">
          {message}
        </p>
      )}
    </section>
  );
}
