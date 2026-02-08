import * as XLSX from 'xlsx';
import { RawTabularData, CsvDelimiter } from '@/types/importMapping';

export function parseCSVLine(line: string, delimiter: string = ';'): string[] {
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

export function readCsvToRaw(content: string, delimiter: CsvDelimiter = ';'): RawTabularData {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length === 0) {
    return { headers: [], rows: [], fileType: 'csv' };
  }

  const headerFields = parseCSVLine(lines[0], delimiter);
  const rows: string[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i], delimiter);
    rows.push(row);
  }

  return {
    headers: headerFields,
    rows,
    fileType: 'csv',
  };
}

export function readExcelToRaw(data: ArrayBuffer): RawTabularData {
  const workbook = XLSX.read(data, { type: 'array', raw: false });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [], fileType: 'excel' };
  }

  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as string[][];

  if (jsonData.length === 0) {
    return { headers: [], rows: [], fileType: 'excel' };
  }

  // Find the first non-empty row as header
  let headerIndex = 0;
  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (row && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')) {
      headerIndex = i;
      break;
    }
  }

  const headerRow = Array.from(jsonData[headerIndex] || []);
  const headers = headerRow.map(cell => String(cell ?? ''));

  const rows: string[][] = [];
  for (let i = headerIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
      continue;
    }
    rows.push(Array.from(row).map(cell => String(cell ?? '')));
  }

  return {
    headers,
    rows,
    fileType: 'excel',
  };
}

export function detectCsvDelimiter(content: string): CsvDelimiter {
  const firstLine = content.split(/\r?\n/)[0] || '';

  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (tabCount > semicolonCount && tabCount > commaCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  if (commaCount > 0) return ',';
  return ';';
}
