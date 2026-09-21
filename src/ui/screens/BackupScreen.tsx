import { useRef, useState } from 'react';
import { exportBackup, importBackup } from '../../infra/storage/backup';
import { formatDay } from '../../domain/reports';
import { saveBlob } from '../saveFile';
import { failureMessage } from '../failureMessage';
import type { EstoqueRepository } from '../../infra/storage/EstoqueRepository';
import type { UseInventoryReturn } from '../hooks/useInventory';

type BackupScreenProps = {
  repository: EstoqueRepository;
  inventory: UseInventoryReturn;
  isOnline: boolean;
};

export function BackupScreen({ repository, inventory, isOnline }: BackupScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | undefined>();

  const inform = (text: string) => setMessage({ text, failed: false });
  const fail = (text: string) => setMessage({ text, failed: true });

  async function handleExport() {
    try {
      const json = await exportBackup(repository);
      const blob = new Blob([json], { type: 'application/json' });
      // Data local no nome: toISOString() usaria UTC e, às 22h em Chapecó, já seria o dia seguinte.
      // saveBlob entrega pelo menu de compartilhar no iPhone com o app instalado, onde o
      // download direto não funciona.
      await saveBlob(blob, `laurea-estoque-backup-${formatDay(new Date())}.json`);
    } catch (cause) {
      console.error('Falha ao exportar backup', cause);
      fail(failureMessage(cause));
    }
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const result = await importBackup(repository, text);
      if (result.ok) {
        await inventory.reload();
        inform('Backup importado com sucesso.');
      } else {
        fail('Não foi possível importar: arquivo inválido.');
      }
    } catch (cause) {
      console.error('Falha ao importar backup', cause);
      fail(failureMessage(cause));
    }
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
          disabled={!isOnline}
          title={!isOnline ? 'Indisponível offline' : undefined}
          className="rounded-md border border-taupe/40 px-4 py-2 font-medium text-ink hover:bg-cream disabled:opacity-50"
        >
          Escolher arquivo...
        </button>
      </div>

      {message && (
        <p role="status" className={`text-sm ${message.failed ? 'text-alert' : 'text-ok'}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
