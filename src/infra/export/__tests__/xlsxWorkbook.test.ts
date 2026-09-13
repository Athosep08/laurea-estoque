import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import type { WorkbookModel } from '../../../application/reportWorkbook';
import { workbookToBlob } from '../xlsxWorkbook';

/**
 * Gera um .xlsx de verdade e abre o zip para conferir o que o Excel vai ler:
 * abas, cabeçalho congelado, formato de moeda e os valores como número.
 */
const model: WorkbookModel = {
  fileName: 'teste.xlsx',
  sheets: [
    {
      name: 'Resumo',
      preamble: [["L'AUREA Aromas — relatório"], ['Gerado em', new Date(2026, 8, 13, 15, 30)]],
      columns: [
        { header: 'Indicador', kind: 'text', width: 40 },
        { header: 'No período', kind: 'text', width: 16 },
      ],
      rows: [
        ['Faturamento', { value: 154.52, kind: 'money' }],
        ['Velas vendidas', { value: 3, kind: 'integer' }],
      ],
    },
    {
      name: 'Vendas',
      columns: [
        { header: 'Aroma', kind: 'text', width: 20 },
        { header: 'Valor cobrado', kind: 'money', width: 15 },
      ],
      rows: [
        ['Lavanda', 118.62],
        ['Café', null],
      ],
      total: ['Total', 118.62],
    },
  ],
};

function readBytes(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

async function unzip(blob: Blob) {
  const files = unzipSync(new Uint8Array(await readBytes(blob)));
  return (path: string) => strFromU8(files[path]);
}

describe('workbookToBlob', () => {
  it('gera um .xlsx com as abas na ordem e nomes certos', async () => {
    const blob = await workbookToBlob(model);
    const read = await unzip(blob);

    expect(blob.size).toBeGreaterThan(0);
    const workbook = read('xl/workbook.xml');
    expect(workbook.indexOf('name="Resumo"')).toBeLessThan(workbook.indexOf('name="Vendas"'));
  });

  it('grava dinheiro como número com formato de real, não como texto', async () => {
    const read = await unzip(await workbookToBlob(model));

    expect(read('xl/styles.xml')).toContain('&quot;R$&quot; #,##0.00');
    const vendas = read('xl/worksheets/sheet2.xml');
    expect(vendas).toContain('<v>118.62</v>');
    expect(vendas).not.toContain('R$ 118');
  });

  it('congela a linha de cabeçalho, contando o preâmbulo', async () => {
    const read = await unzip(await workbookToBlob(model));

    // Resumo: 2 linhas de preâmbulo + 1 em branco + cabeçalho = congela 4.
    expect(read('xl/worksheets/sheet1.xml')).toMatch(/<pane[^>]*ySplit="4"/);
    expect(read('xl/worksheets/sheet2.xml')).toMatch(/<pane[^>]*ySplit="1"/);
  });
});
