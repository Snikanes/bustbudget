import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { X, Save } from 'lucide-react';
import {
  RawTabularData,
  ColumnRole,
  DateFormat,
  AmountMode,
  DecimalSeparator,
  CsvDelimiter,
  ImportMappingConfig,
  ColumnMapping,
} from '@/types/importMapping';
import {
  applyMapping,
  autoDetectColumnRoles,
  autoDetectDateFormat,
  autoDetectDecimalSeparator,
  parseDateWithFormat,
} from '@/utils/tabularParser';
import { readCsvToRaw, detectCsvDelimiter } from '@/utils/rawFileReader';
import { ParsedTransaction } from '@/utils/qfxParser';
import { useImportProfiles, useCreateImportProfile, useUpdateImportProfile, useDeleteImportProfile } from '@/hooks/queries/useImportProfiles';

const ROLE_OPTIONS: { value: ColumnRole; label: string }[] = [
  { value: 'skip', label: 'Skip' },
  { value: 'date', label: 'Date' },
  { value: 'amount', label: 'Amount' },
  { value: 'inflow', label: 'Inflow' },
  { value: 'outflow', label: 'Outflow' },
  { value: 'payee', label: 'Payee' },
  { value: 'memo', label: 'Memo' },
];

const ROLE_COLORS: Record<ColumnRole, string> = {
  date: 'bg-blue-50 border-blue-200',
  amount: 'bg-green-50 border-green-200',
  inflow: 'bg-emerald-50 border-emerald-200',
  outflow: 'bg-red-50 border-red-200',
  payee: 'bg-purple-50 border-purple-200',
  memo: 'bg-yellow-50 border-yellow-200',
  skip: 'bg-gray-50 border-gray-200',
};

const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY (31.01.2026)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-01-31)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (01/31/2026)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/01/2026)' },
  { value: 'YYYY/MM/DD', label: 'YYYY/MM/DD (2026/01/31)' },
];

const AMOUNT_MODE_OPTIONS: { value: AmountMode; label: string; description: string }[] = [
  { value: 'single', label: 'Single column', description: 'Negative = outflow' },
  { value: 'single_inverted', label: 'Single (inverted)', description: 'Positive = outflow' },
  { value: 'split', label: 'Split columns', description: 'Separate inflow/outflow' },
];

interface ColumnMappingModalProps {
  rawData: RawTabularData;
  fileName: string;
  originalContent: string | ArrayBuffer;
  fileType: 'csv' | 'excel';
  startingBalanceDate?: string;
  onClose: () => void;
  onMappingComplete: (transactions: ParsedTransaction[]) => void;
}

function ColumnMappingModal({
  rawData: initialRawData,
  fileName,
  originalContent,
  fileType,
  startingBalanceDate,
  onClose,
  onMappingComplete,
}: ColumnMappingModalProps) {
  const { data: profiles } = useImportProfiles();
  const createProfile = useCreateImportProfile();
  const updateProfile = useUpdateImportProfile();
  const deleteProfile = useDeleteImportProfile();
  const isLoadingProfileRef = useRef(false);

  const [rawData, setRawData] = useState(initialRawData);
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [skipRows, setSkipRows] = useState(0);

  // Initialize with auto-detection
  const [columnRoles, setColumnRoles] = useState<Map<number, ColumnRole>>(() => {
    return autoDetectColumnRoles(initialRawData.headers);
  });

  const [dateFormat, setDateFormat] = useState<DateFormat>(() => {
    const detected = autoDetectColumnRoles(initialRawData.headers);
    const dateCol = Array.from(detected.entries()).find(([, r]) => r === 'date');
    if (dateCol !== undefined) {
      const samples = initialRawData.rows.slice(0, 10).map(r => r[dateCol[0]] || '').filter(Boolean);
      return autoDetectDateFormat(samples);
    }
    return 'DD.MM.YYYY';
  });

  const [amountMode, setAmountMode] = useState<AmountMode>(() => {
    const detected = autoDetectColumnRoles(initialRawData.headers);
    if (detected.has(Array.from(detected.entries()).find(([, r]) => r === 'inflow')?.[0] ?? -1)) {
      return 'split';
    }
    return 'single';
  });

  const [decimalSeparator, setDecimalSeparator] = useState<DecimalSeparator>(() => {
    const detected = autoDetectColumnRoles(initialRawData.headers);
    const amountCol = Array.from(detected.entries()).find(([, r]) => r === 'amount');
    if (amountCol !== undefined) {
      const samples = initialRawData.rows.slice(0, 10).map(r => r[amountCol[0]] || '').filter(Boolean);
      return autoDetectDecimalSeparator(samples);
    }
    return ',';
  });

  const [csvDelimiter, setCsvDelimiter] = useState<CsvDelimiter>(() => {
    if (fileType === 'csv' && typeof originalContent === 'string') {
      return detectCsvDelimiter(originalContent);
    }
    return ';';
  });

  const [dateFrom, setDateFrom] = useState(() => startingBalanceDate ?? '');
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [saveProfileName, setSaveProfileName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  // Re-parse CSV when delimiter changes
  const handleDelimiterChange = useCallback((newDelimiter: CsvDelimiter) => {
    setCsvDelimiter(newDelimiter);
    if (fileType === 'csv' && typeof originalContent === 'string') {
      const newRawData = readCsvToRaw(originalContent, newDelimiter);
      setRawData(newRawData);
      // Re-run auto-detect with new data
      const newRoles = autoDetectColumnRoles(newRawData.headers);
      setColumnRoles(newRoles);

      const dateCol = Array.from(newRoles.entries()).find(([, r]) => r === 'date');
      if (dateCol !== undefined) {
        const samples = newRawData.rows.slice(0, 10).map(r => r[dateCol[0]] || '').filter(Boolean);
        setDateFormat(autoDetectDateFormat(samples));
      }

      const amountCol = Array.from(newRoles.entries()).find(([, r]) => r === 'amount');
      if (amountCol !== undefined) {
        const samples = newRawData.rows.slice(0, 10).map(r => r[amountCol[0]] || '').filter(Boolean);
        setDecimalSeparator(autoDetectDecimalSeparator(samples));
      }
    }
  }, [fileType, originalContent]);

  // Determine display headers
  const displayHeaders = useMemo(() => {
    if (hasHeaderRow) return rawData.headers;
    return rawData.headers.map((_, i) => `Column ${String.fromCharCode(65 + i)}`);
  }, [rawData.headers, hasHeaderRow]);

  // All data rows (without header)
  const allDataRows = useMemo(() => {
    return hasHeaderRow ? rawData.rows : [rawData.headers, ...rawData.rows];
  }, [rawData, hasHeaderRow]);

  // Skipped rows: always show first and last, summarize middle
  const skippedFirstRow = useMemo(() => {
    return skipRows > 0 ? allDataRows[0] : null;
  }, [allDataRows, skipRows]);

  const skippedLastRow = useMemo(() => {
    return skipRows > 1 ? allDataRows[skipRows - 1] : null;
  }, [allDataRows, skipRows]);

  const skippedMiddleCount = Math.max(0, skipRows - 2);

  // Active data rows to show (first 5 after skipped)
  const displayRows = useMemo(() => {
    return allDataRows.slice(skipRows, skipRows + 5);
  }, [allDataRows, skipRows]);

  const totalRows = useMemo(() => {
    return allDataRows.length;
  }, [allDataRows]);

  const handleRoleChange = useCallback((colIndex: number, role: ColumnRole) => {
    setColumnRoles(prev => {
      const next = new Map(prev);

      // If this role is already assigned to a different column, clear it (except 'skip')
      if (role !== 'skip') {
        for (const [idx, existingRole] of next) {
          if (existingRole === role && idx !== colIndex) {
            next.delete(idx);
          }
        }
      }

      if (role === 'skip') {
        next.delete(colIndex);
      } else {
        next.set(colIndex, role);
      }

      return next;
    });
  }, []);

  // Build config from current state
  const currentConfig = useMemo((): ImportMappingConfig => {
    const columns: ColumnMapping[] = displayHeaders.map((header, i) => ({
      columnIndex: i,
      columnHeader: header,
      role: columnRoles.get(i) || 'skip' as ColumnRole,
    }));

    return {
      columns,
      dateFormat,
      amountMode,
      decimalSeparator,
      csvDelimiter,
      hasHeaderRow,
      skipRows,
    };
  }, [displayHeaders, columnRoles, dateFormat, amountMode, decimalSeparator, csvDelimiter, hasHeaderRow, skipRows]);

  // Validation
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    const roles = Array.from(columnRoles.values());

    if (!roles.includes('date')) {
      errors.push('A date column must be mapped.');
    }

    if (amountMode === 'split') {
      if (!roles.includes('inflow') && !roles.includes('outflow')) {
        errors.push('Split mode requires at least one inflow or outflow column.');
      }
    } else {
      if (!roles.includes('amount')) {
        errors.push('An amount column must be mapped.');
      }
    }

    return errors;
  }, [columnRoles, amountMode]);

  // Filter transactions by date range
  const filterByDateRange = useCallback((transactions: ParsedTransaction[]) => {
    if (!dateFrom && !dateTo) return transactions;
    return transactions.filter(t => {
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;
      return true;
    });
  }, [dateFrom, dateTo]);

  // Live transaction count — run the parser to show how many rows will import
  const parsedTransactionCount = useMemo(() => {
    if (validationErrors.length > 0) return null;
    const dataForParsing: RawTabularData = hasHeaderRow
      ? rawData
      : { ...rawData, headers: displayHeaders, rows: [rawData.headers, ...rawData.rows] };
    const result = applyMapping(dataForParsing, currentConfig);
    if (result.error) return null;
    return filterByDateRange(result.transactions).length;
  }, [rawData, hasHeaderRow, displayHeaders, currentConfig, validationErrors, filterByDateRange]);

  // Date preview
  const datePreview = useMemo(() => {
    const dateCol = Array.from(columnRoles.entries()).find(([, r]) => r === 'date');
    if (dateCol === undefined) return null;
    const sampleRows = hasHeaderRow ? rawData.rows : [rawData.headers, ...rawData.rows];
    for (const row of sampleRows.slice(skipRows, skipRows + 5)) {
      const val = row[dateCol[0]];
      if (val) {
        const parsed = parseDateWithFormat(val, dateFormat);
        if (parsed) return { original: val, parsed };
      }
    }
    return null;
  }, [columnRoles, dateFormat, rawData, hasHeaderRow, skipRows]);

  // Load profile
  const handleProfileSelect = useCallback((profileId: string) => {
    setSelectedProfileId(profileId);
    if (!profileId || !profiles) return;
    isLoadingProfileRef.current = true;

    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    const config = profile.config;

    // Validate column indices against current file
    const maxCol = displayHeaders.length;
    const newRoles = new Map<number, ColumnRole>();
    for (const col of config.columns) {
      if (col.columnIndex < maxCol && col.role !== 'skip') {
        newRoles.set(col.columnIndex, col.role);
      }
    }

    // If profile has out-of-range columns, fall back to auto-detect
    const hasValidMappings = newRoles.size > 0;
    if (hasValidMappings) {
      setColumnRoles(newRoles);
      setDateFormat(config.dateFormat);
      setAmountMode(config.amountMode);
      setDecimalSeparator(config.decimalSeparator);
      if (fileType === 'csv') {
        handleDelimiterChange(config.csvDelimiter);
      }
      setHasHeaderRow(config.hasHeaderRow);
      setSkipRows(config.skipRows);
    }
  }, [profiles, displayHeaders.length, fileType, handleDelimiterChange]);

  // Save profile (upsert: update if name already exists)
  const handleSaveProfile = useCallback(() => {
    const name = saveProfileName.trim();
    if (!name) return;

    const existing = profiles?.find(p => p.fileType === fileType && p.name === name);

    const onSuccess = (profile: { id: string }) => {
      isLoadingProfileRef.current = true;
      setSelectedProfileId(profile.id);
      setSaveProfileName('');
      setShowSaveInput(false);
    };

    if (existing) {
      updateProfile.mutate(
        { id: existing.id, config: currentConfig },
        { onSuccess: () => onSuccess(existing) }
      );
    } else {
      createProfile.mutate(
        { name, fileType, config: currentConfig },
        { onSuccess: (profile) => onSuccess(profile) }
      );
    }
  }, [saveProfileName, fileType, currentConfig, profiles, createProfile, updateProfile]);

  // Auto-save profile when config changes while a profile is selected
  useEffect(() => {
    if (!selectedProfileId) return;
    if (isLoadingProfileRef.current) {
      isLoadingProfileRef.current = false;
      return;
    }
    updateProfile.mutate({ id: selectedProfileId, config: currentConfig });
  }, [currentConfig, selectedProfileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Import
  const handleImport = useCallback(() => {
    const dataForParsing: RawTabularData = hasHeaderRow
      ? rawData
      : { ...rawData, headers: displayHeaders, rows: [rawData.headers, ...rawData.rows] };

    const result = applyMapping(dataForParsing, currentConfig);
    if (result.error) {
      // show inline — for now just alert
      alert(result.error);
      return;
    }
    onMappingComplete(filterByDateRange(result.transactions));
  }, [rawData, hasHeaderRow, displayHeaders, currentConfig, onMappingComplete, filterByDateRange]);

  // When amount mode changes, clear incompatible role assignments
  useEffect(() => {
    setColumnRoles(prev => {
      const next = new Map(prev);
      if (amountMode === 'split') {
        // Remove 'amount' role
        for (const [idx, role] of next) {
          if (role === 'amount') next.delete(idx);
        }
      } else {
        // Remove inflow/outflow roles
        for (const [idx, role] of next) {
          if (role === 'inflow' || role === 'outflow') next.delete(idx);
        }
      }
      return next;
    });
  }, [amountMode]);

  // Filter role options based on amount mode
  const availableRoles = useMemo(() => {
    if (amountMode === 'split') {
      return ROLE_OPTIONS.filter(r => r.value !== 'amount');
    }
    return ROLE_OPTIONS.filter(r => r.value !== 'inflow' && r.value !== 'outflow');
  }, [amountMode]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold">Map Columns</h2>
            <p className="text-sm text-gray-500 mt-0.5">{fileName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-5">
          {/* Profile selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Profile:</label>
              <select
                value={selectedProfileId}
                onChange={(e) => handleProfileSelect(e.target.value)}
                className="flex-1 max-w-xs text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Auto-detect</option>
                {profiles?.filter(p => p.fileType === fileType).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {selectedProfileId && (
                <button
                  onClick={() => {
                    if (confirm('Delete this profile?')) {
                      deleteProfile.mutate(selectedProfileId);
                      setSelectedProfileId('');
                    }
                  }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              )}
            </div>

            {showSaveInput ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={saveProfileName}
                  onChange={(e) => setSaveProfileName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveProfile(); if (e.key === 'Escape') setShowSaveInput(false); }}
                  placeholder="Profile name..."
                  autoFocus
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSaveProfile}
                  disabled={!saveProfileName.trim() || createProfile.isPending}
                  className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowSaveInput(false)}
                  className="text-sm px-2 py-1.5 text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveInput(true)}
                className="flex items-center gap-1 text-sm px-3 py-1.5 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Save as profile
              </button>
            )}
          </div>

          {/* Config panel */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date format</label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value as DateFormat)}
                className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DATE_FORMAT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {datePreview && (
                <p className="text-xs text-gray-500 mt-1">
                  "{datePreview.original}" &rarr; {datePreview.parsed}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount mode</label>
              <select
                value={amountMode}
                onChange={(e) => setAmountMode(e.target.value as AmountMode)}
                className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {AMOUNT_MODE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label} — {opt.description}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Decimal separator</label>
              <select
                value={decimalSeparator}
                onChange={(e) => setDecimalSeparator(e.target.value as DecimalSeparator)}
                className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value=",">Comma (1.000,00)</option>
                <option value=".">Dot (1,000.00)</option>
              </select>
            </div>

            {fileType === 'csv' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">CSV delimiter</label>
                <select
                  value={csvDelimiter}
                  onChange={(e) => handleDelimiterChange(e.target.value as CsvDelimiter)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value=";">Semicolon (;)</option>
                  <option value=",">Comma (,)</option>
                  <option value={'\t'}>Tab</option>
                </select>
              </div>
            )}
          </div>

          {/* Header row toggle, skip rows, and date range */}
          <div className="flex items-center gap-6 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={hasHeaderRow}
                onChange={(e) => setHasHeaderRow(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              First row is header
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              Skip rows:
              <input
                type="number"
                min={0}
                max={Math.max(0, totalRows - 1)}
                value={skipRows}
                onChange={(e) => setSkipRows(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span>From:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span>To:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              {validationErrors.map((err, i) => (
                <p key={i} className="text-sm text-amber-800">{err}</p>
              ))}
            </div>
          )}

          {/* Data preview table */}
          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {/* Role selector row */}
                <tr className="border-b border-gray-200 bg-gray-50">
                  {displayHeaders.map((_, colIndex) => (
                    <th key={colIndex} className="px-2 py-1.5 min-w-[120px]">
                      <select
                        value={columnRoles.get(colIndex) || 'skip'}
                        onChange={(e) => handleRoleChange(colIndex, e.target.value as ColumnRole)}
                        className={`w-full text-xs font-medium border rounded px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          ROLE_COLORS[columnRoles.get(colIndex) || 'skip']
                        }`}
                      >
                        {availableRoles.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
                {/* Header row */}
                <tr className="border-b border-gray-300 bg-gray-100">
                  {displayHeaders.map((header, colIndex) => (
                    <th
                      key={colIndex}
                      className={`px-3 py-2 text-left text-xs font-semibold text-gray-700 min-w-[120px] ${
                        columnRoles.get(colIndex) ? '' : 'opacity-50'
                      }`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Skipped rows — first and last shown dimmed, middle summarized */}
                {skippedFirstRow && (
                  <tr className="border-b border-gray-100 bg-red-50/40">
                    {displayHeaders.map((_, colIndex) => (
                      <td
                        key={colIndex}
                        className="px-3 py-1.5 text-xs text-gray-400 line-through"
                      >
                        {colIndex < skippedFirstRow.length ? skippedFirstRow[colIndex] : ''}
                      </td>
                    ))}
                  </tr>
                )}
                {skippedMiddleCount > 0 && (
                  <tr className="border-b border-gray-100 bg-red-50/40">
                    <td
                      colSpan={displayHeaders.length}
                      className="px-3 py-1 text-xs text-gray-400 text-center italic"
                    >
                      ...{skippedMiddleCount} more skipped row{skippedMiddleCount !== 1 ? 's' : ''}...
                    </td>
                  </tr>
                )}
                {skippedLastRow && (
                  <tr className="border-b border-gray-100 bg-red-50/40">
                    {displayHeaders.map((_, colIndex) => (
                      <td
                        key={colIndex}
                        className="px-3 py-1.5 text-xs text-gray-400 line-through"
                      >
                        {colIndex < skippedLastRow.length ? skippedLastRow[colIndex] : ''}
                      </td>
                    ))}
                  </tr>
                )}
                {/* Active data rows */}
                {displayRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-b border-gray-100 hover:bg-gray-50">
                    {displayHeaders.map((_, colIndex) => {
                      const role = columnRoles.get(colIndex);
                      const isSkipped = !role || role === 'skip';
                      return (
                        <td
                          key={colIndex}
                          className={`px-3 py-1.5 text-xs ${
                            isSkipped ? 'text-gray-400' : 'text-gray-800'
                          } ${role ? ROLE_COLORS[role].replace('border-', 'border-l-2 border-l-').split(' ')[0] : ''}`}
                        >
                          {colIndex < row.length ? row[colIndex] : ''}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 py-1.5 text-xs text-gray-500 bg-gray-50 border-t border-gray-200 flex justify-between">
              <span>
                Showing {Math.min(5, displayRows.length)} of {totalRows - skipRows} data rows
                {skipRows > 0 && <span className="text-gray-400"> ({skipRows} skipped)</span>}
              </span>
              {parsedTransactionCount !== null && (
                <span className="font-medium text-gray-700">
                  {parsedTransactionCount} transaction{parsedTransactionCount !== 1 ? 's' : ''} will be imported
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={validationErrors.length > 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

export default ColumnMappingModal;
