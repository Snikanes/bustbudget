import {
  RawTabularData,
  ImportMappingConfig,
  DateFormat,
  DecimalSeparator,
  ColumnRole,
} from '@/types/importMapping';
import { ParseResult, ParsedTransaction } from './qfxParser';

function findColumnByRole(config: ImportMappingConfig, role: ColumnRole): number {
  const col = config.columns.find(c => c.role === role);
  return col ? col.columnIndex : -1;
}

export function parseDateWithFormat(dateStr: string, format: DateFormat): string | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Skip reserved/pending transactions
  if (trimmed.toLowerCase() === 'reservert') return null;

  // Excel stores dates as serial numbers (days since 1899-12-30, accounting
  // for the 1900 leap-year bug). Some bank exports omit the cell's date
  // format, so SheetJS surfaces the raw number as a string like "46112".
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = parseFloat(trimmed);
    // Bounds: ~1955-01-01 (20089) to ~2119-12-31 (80296)
    if (serial >= 20000 && serial <= 80000) {
      const ms = Math.round((serial - 25569) * 86400 * 1000);
      const date = new Date(ms);
      if (!isNaN(date.getTime())) {
        const y = date.getUTCFullYear();
        const mo = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        return `${y}-${mo}-${d}`;
      }
    }
  }

  let day: string, month: string, year: string;

  switch (format) {
    case 'DD.MM.YYYY': {
      const match = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (!match) return null;
      day = match[1].padStart(2, '0');
      month = match[2].padStart(2, '0');
      year = match[3];
      break;
    }
    case 'YYYY-MM-DD': {
      const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (!match) return null;
      year = match[1];
      month = match[2].padStart(2, '0');
      day = match[3].padStart(2, '0');
      break;
    }
    case 'MM/DD/YYYY': {
      const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!match) return null;
      month = match[1].padStart(2, '0');
      day = match[2].padStart(2, '0');
      year = match[3];
      break;
    }
    case 'DD/MM/YYYY': {
      const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!match) return null;
      day = match[1].padStart(2, '0');
      month = match[2].padStart(2, '0');
      year = match[3];
      break;
    }
    case 'YYYY/MM/DD': {
      const match = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
      if (!match) return null;
      year = match[1];
      month = match[2].padStart(2, '0');
      day = match[3].padStart(2, '0');
      break;
    }
    default:
      return null;
  }

  // Basic validation
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  return `${year}-${month}-${day}`;
}

export function parseDecimal(value: string, decimalSeparator: DecimalSeparator): number | null {
  let cleaned = value.trim();
  if (!cleaned) return null;

  // Remove currency symbols and whitespace
  cleaned = cleaned.replace(/[^\d.,\-+]/g, '');
  if (!cleaned) return null;

  if (decimalSeparator === ',') {
    // Thousands separator is dot, decimal is comma
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Thousands separator is comma, decimal is dot
    cleaned = cleaned.replace(/,/g, '');
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  return Math.round(num * 100);
}

function parseAmountValue(
  row: string[],
  config: ImportMappingConfig,
): number | null {
  const { amountMode, decimalSeparator } = config;

  if (amountMode === 'split') {
    const inflowIdx = findColumnByRole(config, 'inflow');
    const outflowIdx = findColumnByRole(config, 'outflow');

    const inflowStr = inflowIdx >= 0 && inflowIdx < row.length ? row[inflowIdx] : '';
    const outflowStr = outflowIdx >= 0 && outflowIdx < row.length ? row[outflowIdx] : '';

    const inflowAmt = inflowStr ? parseDecimal(inflowStr, decimalSeparator) : 0;
    const outflowAmt = outflowStr ? parseDecimal(outflowStr, decimalSeparator) : 0;

    if (inflowAmt === null && outflowAmt === null) return null;

    // Inflow is positive, outflow is negative
    const inflow = Math.abs(inflowAmt || 0);
    const outflow = Math.abs(outflowAmt || 0);

    if (inflow > 0) return inflow;
    if (outflow > 0) return -outflow;
    return 0;
  }

  // Single column mode
  const amountIdx = findColumnByRole(config, 'amount');
  if (amountIdx < 0 || amountIdx >= row.length) return null;

  const amount = parseDecimal(row[amountIdx], decimalSeparator);
  if (amount === null) return null;

  // In 'single_inverted' mode, positive means outflow
  if (amountMode === 'single_inverted') {
    return -amount;
  }

  return amount;
}

export function applyMapping(data: RawTabularData, config: ImportMappingConfig): ParseResult {
  try {
    const dateIdx = findColumnByRole(config, 'date');
    const payeeIdx = findColumnByRole(config, 'payee');
    const memoIdx = findColumnByRole(config, 'memo');

    // Validate required columns
    if (dateIdx < 0) {
      return { transactions: [], error: 'No date column mapped.' };
    }

    if (config.amountMode === 'split') {
      const inflowIdx = findColumnByRole(config, 'inflow');
      const outflowIdx = findColumnByRole(config, 'outflow');
      if (inflowIdx < 0 && outflowIdx < 0) {
        return { transactions: [], error: 'Split mode requires at least one inflow or outflow column mapped.' };
      }
    } else {
      const amountIdx = findColumnByRole(config, 'amount');
      if (amountIdx < 0) {
        return { transactions: [], error: 'No amount column mapped.' };
      }
    }

    const transactions: ParsedTransaction[] = [];
    const rowsToProcess = data.rows.slice(config.skipRows);

    for (const row of rowsToProcess) {
      if (dateIdx >= row.length) continue;

      const dateStr = row[dateIdx];
      const date = parseDateWithFormat(dateStr, config.dateFormat);
      if (!date) continue;

      const amount = parseAmountValue(row, config);
      if (amount === null) continue;

      const payee = payeeIdx >= 0 && payeeIdx < row.length ? row[payeeIdx].trim() : '';
      const memo = memoIdx >= 0 && memoIdx < row.length ? row[memoIdx].trim() : '';

      const fitId = `${date}-${amount}-${payee}`.replace(/[^a-zA-Z0-9-]/g, '');

      transactions.push({ date, amount, payee, memo, fitId });
    }

    if (transactions.length === 0) {
      return { transactions: [], error: 'No valid transactions found with the current mapping.' };
    }

    transactions.sort((a, b) => b.date.localeCompare(a.date));
    return { transactions };
  } catch (error) {
    return {
      transactions: [],
      error: `Failed to parse: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Auto-detect helpers

const DATE_KEYWORDS: Record<string, true> = {
  date: true, dato: true, bokført: true, bokføringsdato: true, bokforingsdato: true,
  'transaction date': true, 'trans date': true, posted: true,
};

const AMOUNT_KEYWORDS: Record<string, true> = {
  amount: true, beløp: true, belop: true, sum: true, 'transaction amount': true,
};

const INFLOW_KEYWORDS: Record<string, true> = {
  inflow: true, credit: true, deposit: true, inn: true, innbetaling: true,
};

const OUTFLOW_KEYWORDS: Record<string, true> = {
  outflow: true, debit: true, withdrawal: true, ut: true, utbetaling: true,
};

const PAYEE_KEYWORDS: Record<string, true> = {
  payee: true, description: true, beskrivelse: true, tittel: true,
  spesifikasjon: true, name: true, merchant: true, mottaker: true,
};

const MEMO_KEYWORDS: Record<string, true> = {
  memo: true, note: true, notes: true, notat: true, comment: true, melding: true,
  reference: true, referanse: true,
};

export function autoDetectColumnRoles(headers: string[]): Map<number, ColumnRole> {
  const roles = new Map<number, ColumnRole>();
  const assignedRoles = new Set<ColumnRole>();

  for (let i = 0; i < headers.length; i++) {
    const lower = (headers[i] ?? '').toLowerCase().trim();
    if (!lower) continue;

    let role: ColumnRole | null = null;
    if (DATE_KEYWORDS[lower] && !assignedRoles.has('date')) {
      role = 'date';
    } else if (AMOUNT_KEYWORDS[lower] && !assignedRoles.has('amount')) {
      role = 'amount';
    } else if (INFLOW_KEYWORDS[lower] && !assignedRoles.has('inflow')) {
      role = 'inflow';
    } else if (OUTFLOW_KEYWORDS[lower] && !assignedRoles.has('outflow')) {
      role = 'outflow';
    } else if (PAYEE_KEYWORDS[lower] && !assignedRoles.has('payee')) {
      role = 'payee';
    } else if (MEMO_KEYWORDS[lower] && !assignedRoles.has('memo')) {
      role = 'memo';
    }

    if (role) {
      roles.set(i, role);
      assignedRoles.add(role);
    }
  }

  return roles;
}

export function autoDetectDateFormat(sampleValues: string[]): DateFormat {
  for (const val of sampleValues) {
    const trimmed = val.trim();
    if (!trimmed) continue;

    if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(trimmed)) return 'DD.MM.YYYY';
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) return 'YYYY-MM-DD';
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(trimmed)) return 'YYYY/MM/DD';

    // Ambiguous slash formats — heuristic: if first part > 12, it's day
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const first = parseInt(slashMatch[1], 10);
      const second = parseInt(slashMatch[2], 10);
      if (first > 12 && second <= 12) return 'DD/MM/YYYY';
      if (second > 12 && first <= 12) return 'MM/DD/YYYY';
      // Default to DD/MM/YYYY for European convention
      return 'DD/MM/YYYY';
    }
  }

  return 'DD.MM.YYYY';
}

export function autoDetectDecimalSeparator(sampleValues: string[]): DecimalSeparator {
  for (const val of sampleValues) {
    const cleaned = val.replace(/[^\d.,]/g, '');
    // If there's a comma followed by exactly 2 digits at end, comma is decimal
    if (/,\d{2}$/.test(cleaned) && !/\.\d{2}$/.test(cleaned)) return ',';
    // If there's a dot followed by exactly 2 digits at end, dot is decimal
    if (/\.\d{2}$/.test(cleaned) && !/,\d{2}$/.test(cleaned)) return '.';
  }
  return ',';
}
