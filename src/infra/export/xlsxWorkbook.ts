import type { Cell, SheetData } from 'write-excel-file/browser';
import type {
  CellKind,
  CellValue,
  TypedCell,
  WorkbookModel,
} from '../../application/reportWorkbook';

/**
 * Adaptador: transforma o modelo de planilha (montado em `application/`) num
 * arquivo .xlsx. É o único lugar que conhece a biblioteca `write-excel-file`,
 * e ela é carregada só na hora de exportar (import dinâmico), para não pesar
 * na abertura do app.
 *
 * Os códigos de formato são os do Excel, que usa o separador de milhar e de
 * decimal do idioma de quem abre: no Excel em português, `#,##0.00` aparece
 * como 1.234,56.
 */
const FORMAT: Record<CellKind, string | undefined> = {
  text: undefined,
  integer: '0',
  number: undefined,
  money: '"R$" #,##0.00',
  percent: '0%',
  datetime: 'dd/mm/yyyy hh:mm',
};

const HEADER_STYLE = {
  fontWeight: 'bold' as const,
  backgroundColor: '#F5F1E9',
  bottomBorderStyle: 'thin' as const,
  bottomBorderColor: '#7C7466',
};

function isTyped(value: CellValue | TypedCell): value is TypedCell {
  return value !== null && typeof value === 'object' && !(value instanceof Date);
}

function toCell(input: CellValue | TypedCell, columnKind: CellKind, bold = false): Cell {
  const kind = isTyped(input) ? input.kind : columnKind;
  const value = isTyped(input) ? input.value : input;
  if (value === null || value === '') return null;
  const style = bold ? { fontWeight: 'bold' as const } : {};
  if (value instanceof Date) return { value, type: Date, format: FORMAT.datetime, ...style };
  if (typeof value === 'number') return { value, type: Number, format: FORMAT[kind], ...style };
  return { value, type: String, ...style };
}

export async function workbookToBlob(model: WorkbookModel): Promise<Blob> {
  const { default: writeExcelFile } = await import('write-excel-file/browser');

  const sheets = model.sheets.map((sheet) => {
    const data: SheetData = [];
    const preamble = sheet.preamble ?? [];
    // Título e rótulos ("Período", "Gerado em") em negrito; os valores, não.
    preamble.forEach((row, index) => {
      data.push(row.map((value, column) => toCell(value, 'text', index === 0 || column === 0)));
    });
    if (preamble.length) data.push([]);

    data.push(sheet.columns.map((column) => ({ value: column.header, ...HEADER_STYLE })));
    const headerRows = data.length;
    for (const row of sheet.rows) {
      data.push(row.map((value, i) => toCell(value, sheet.columns[i]?.kind ?? 'text')));
    }
    if (sheet.total) {
      data.push(
        sheet.total.map((value, i) => toCell(value, sheet.columns[i]?.kind ?? 'text', true)),
      );
    }

    return {
      data,
      sheet: sheet.name,
      columns: sheet.columns.map((column) => ({ width: column.width })),
      stickyRowsCount: headerRows,
    };
  });

  return writeExcelFile(sheets, { fontFamily: 'Calibri', fontSize: 11 }).toBlob();
}
