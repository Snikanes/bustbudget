// CSV Parser for Norwegian bank exports (e.g., DNB)
// Format: semicolon-delimited with Norwegian column names

import { ParsedTransaction, ParseResult } from './qfxParser';

function parseCSVLine(line: string, delimiter: string = ';'): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseDate(dateStr: string): string | null {
  // Skip reserved/pending transactions
  if (dateStr.toLowerCase() === 'reservert') {
    return null;
  }

  // Format: YYYY/MM/DD
  const slashMatch = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2]}-${slashMatch[3]}`;
  }

  // Format: DD.MM.YYYY (fallback for other Norwegian formats)
  const dotMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    const day = dotMatch[1].padStart(2, '0');
    const month = dotMatch[2].padStart(2, '0');
    const year = dotMatch[3];
    return `${year}-${month}-${day}`;
  }

  return null;
}

function parseAmount(amountStr: string): number | null {
  // Norwegian format: uses comma as decimal separator (e.g., "-2705,00")
  const cleaned = amountStr.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);

  if (isNaN(num)) {
    return null;
  }

  // Convert to cents
  return Math.round(num * 100);
}

function findColumnIndex(headers: string[], ...possibleNames: string[]): number {
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  for (const name of possibleNames) {
    const index = lowerHeaders.indexOf(name.toLowerCase());
    if (index !== -1) {
      return index;
    }
  }
  return -1;
}

export function parseCSV(content: string): ParseResult {
  try {
    const lines = content.split(/\r?\n/).filter((line) => line.trim());

    if (lines.length < 2) {
      return {
        transactions: [],
        error: 'CSV file is empty or has no data rows.',
      };
    }

    // Parse header row
    const headers = parseCSVLine(lines[0]);

    // Find column indices - support multiple possible column names
    const dateCol = findColumnIndex(headers, 'bokføringsdato', 'dato', 'date');
    const amountCol = findColumnIndex(headers, 'beløp', 'amount', 'sum');
    const payeeCol = findColumnIndex(headers, 'tittel', 'beskrivelse', 'payee', 'spesifikasjon');

    if (dateCol === -1) {
      return {
        transactions: [],
        error: 'Could not find date column. Expected: Bokføringsdato, Dato, or Date',
      };
    }

    if (amountCol === -1) {
      return {
        transactions: [],
        error: 'Could not find amount column. Expected: Beløp, Amount, or Sum',
      };
    }

    const transactions: ParsedTransaction[] = [];

    // Process data rows
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);

      if (row.length <= Math.max(dateCol, amountCol)) {
        continue;
      }

      const dateStr = row[dateCol];
      const date = parseDate(dateStr);

      // Skip reserved/pending transactions (no valid date)
      if (!date) {
        continue;
      }

      const amount = parseAmount(row[amountCol]);
      if (amount === null) {
        continue;
      }

      const payee = payeeCol !== -1 ? row[payeeCol] || '' : '';

      // Generate a unique ID
      const fitId = `${date}-${amount}-${payee}`.replace(/[^a-zA-Z0-9-]/g, '');

      transactions.push({
        date,
        amount,
        payee,
        memo: '',
        fitId,
      });
    }

    if (transactions.length === 0) {
      return {
        transactions: [],
        error: 'No valid transactions found in CSV file. Reserved transactions are skipped.',
      };
    }

    // Sort by date descending
    transactions.sort((a, b) => b.date.localeCompare(a.date));

    return { transactions };
  } catch (error) {
    return {
      transactions: [],
      error: `Failed to parse CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
