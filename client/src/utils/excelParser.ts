import * as XLSX from 'xlsx';
import { ParsedTransaction, ParseResult } from './qfxParser';

function parseNorwegianDate(dateStr: string): string | null {
  // Norwegian date format: D.M.YYYY or DD.MM.YYYY
  const match = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;

  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3];

  return `${year}-${month}-${day}`;
}

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    // Convert to cents and invert sign (Excel: positive=outflow, App: negative=outflow)
    return Math.round(-value * 100);
  }
  if (typeof value === 'string') {
    // Handle string amounts with comma as decimal separator
    const cleaned = value.replace(/\s/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      return Math.round(-num * 100);
    }
  }
  return null;
}

function getColumnIndex(headerRow: unknown[], columnName: string): number {
  const lowerName = columnName.toLowerCase();
  for (let i = 0; i < headerRow.length; i++) {
    if (String(headerRow[i] || '').toLowerCase() === lowerName) {
      return i;
    }
  }
  return -1;
}

export function parseExcel(data: ArrayBuffer): ParseResult {
  try {
    const workbook = XLSX.read(data, { type: 'array' });

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { transactions: [], error: 'No sheets found in Excel file' };
    }

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

    const transactions: ParsedTransaction[] = [];
    let rowIndex = 0;

    // Process all sections in the file
    while (rowIndex < jsonData.length) {
      // Find the next header row
      let headerIndex = -1;
      for (let i = rowIndex; i < Math.min(jsonData.length, rowIndex + 20); i++) {
        const row = jsonData[i];
        if (!row) continue;
        const rowStr = row.map(cell => String(cell || '').toLowerCase());
        if (rowStr.includes('dato') && rowStr.includes('bokført') && rowStr.includes('beløp')) {
          headerIndex = i;
          break;
        }
      }

      if (headerIndex === -1) {
        // No more header rows found
        break;
      }

      const headerRow = jsonData[headerIndex];
      const dateCol = getColumnIndex(headerRow, 'bokført');
      const payeeCol = getColumnIndex(headerRow, 'spesifikasjon');
      const amountCol = getColumnIndex(headerRow, 'beløp');

      if (dateCol === -1 || amountCol === -1) {
        rowIndex = headerIndex + 1;
        continue;
      }

      // Process data rows after header
      for (let i = headerIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        // Check if this is a summary/total row or new section
        const firstCell = String(row[0] || '').toLowerCase();
        if (firstCell.includes('totalbeløp') || firstCell.includes('saldo')) {
          continue;
        }

        // Check if we hit a new section header
        const rowStr = row.map(cell => String(cell || '').toLowerCase());
        if (rowStr.includes('dato') && rowStr.includes('bokført')) {
          rowIndex = i;
          break;
        }

        // Check for empty date which might indicate end of section
        const dateValue = row[dateCol];
        if (!dateValue) {
          // Could be end of section or empty row
          const hasAnyValue = row.some(cell => cell !== null && cell !== undefined && cell !== '');
          if (!hasAnyValue) continue;

          // Check if it's a section marker (like account number row)
          if (row.length < 4) {
            rowIndex = i + 1;
            break;
          }
          continue;
        }

        const dateStr = String(dateValue);
        const date = parseNorwegianDate(dateStr);
        if (!date) continue;

        const amount = parseAmount(row[amountCol]);
        if (amount === null || amount === 0) continue;

        const payee = payeeCol >= 0 ? String(row[payeeCol] || '').trim() : '';

        // Generate a unique ID based on date, amount, and payee
        const fitId = `${date}-${amount}-${payee}`.replace(/[^a-zA-Z0-9-]/g, '');

        transactions.push({
          date,
          amount,
          payee,
          memo: '',
          fitId,
        });

        rowIndex = i + 1;
      }
    }

    if (transactions.length === 0) {
      return {
        transactions: [],
        error: 'No transactions found in Excel file. Expected columns: Dato, Bokført, Spesifikasjon, Beløp',
      };
    }

    // Sort by date descending
    transactions.sort((a, b) => b.date.localeCompare(a.date));

    return { transactions };
  } catch (error) {
    return {
      transactions: [],
      error: `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
