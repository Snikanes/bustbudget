export type ColumnRole = 'date' | 'amount' | 'inflow' | 'outflow' | 'payee' | 'memo' | 'skip';

export type DateFormat = 'DD.MM.YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY/MM/DD';

export type AmountMode = 'single' | 'single_inverted' | 'split';

export type DecimalSeparator = '.' | ',';

export type CsvDelimiter = ',' | ';' | '\t';

export interface ColumnMapping {
  columnIndex: number;
  columnHeader: string;
  role: ColumnRole;
}

export interface ImportMappingConfig {
  columns: ColumnMapping[];
  dateFormat: DateFormat;
  amountMode: AmountMode;
  decimalSeparator: DecimalSeparator;
  csvDelimiter: CsvDelimiter;
  hasHeaderRow: boolean;
  skipRows: number;
}

export interface ImportProfile {
  id: string;
  name: string;
  fileType: string;
  config: ImportMappingConfig;
  createdAt: string;
  updatedAt: string;
}

export interface RawTabularData {
  headers: string[];
  rows: string[][];
  fileType: 'csv' | 'excel';
}
