import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { ParsedTransaction } from '@/utils/qfxParser';
import { Transaction, Payee } from '@/types';
import { formatNOK } from '@/utils/currency';
import { useImportTransactions } from '@/hooks/queries/useTransactions';
import { useImportPayeeMappings, useCreateImportPayeeMapping } from '@/hooks/queries/useImportPayeeMappings';
import { useCategories } from '@/hooks/queries/useCategories';
import { usePayees, useCreatePayee } from '@/hooks/queries/usePayees';
import PayeeSelect from '@/components/shared/PayeeSelect';
import CategorySelect from '@/components/shared/CategorySelect';

interface ImportPreviewModalProps {
  accountId: string;
  accountName: string;
  transactions: ParsedTransaction[];
  existingTransactions: Transaction[];
  onClose: () => void;
  onImportComplete: (imported: number, skipped: number) => void;
}

interface PreviewTransaction extends ParsedTransaction {
  isDuplicate: boolean;
  originalPayee: string;
  displayPayee: string;
  displayPayeeId: string | null;
  displayCategoryId: string | null;
  isMapped: boolean;
}

// Tracks edits for an original payee
interface PayeeEdit {
  payeeName: string;
  payeeId: string | null; // null means new payee (will be created on import)
  categoryId: string | null;
}

type EditingField = { index: number; field: 'payee' | 'category' } | null;

function ImportPreviewModal({
  accountId,
  accountName,
  transactions,
  existingTransactions,
  onClose,
  onImportComplete,
}: ImportPreviewModalProps) {
  const importTransactions = useImportTransactions();
  const { data: payeeMappings, isLoading: mappingsLoading } = useImportPayeeMappings();
  const { data: categories } = useCategories();
  const { data: payees = [] } = usePayees();
  const createPayeeMapping = useCreateImportPayeeMapping();
  const createPayee = useCreatePayee();

  // Track edits by originalPayee -> { payeeName, payeeId, categoryId }
  const [payeeEdits, setPayeeEdits] = useState<Record<string, PayeeEdit>>({});
  const [editingField, setEditingField] = useState<EditingField>(null);
  // Track excluded transactions by index
  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set());

  // Build a lookup for category names
  const categoryNameLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    categories?.forEach((cat) => {
      lookup.set(cat.id, cat.name);
    });
    return lookup;
  }, [categories]);

  // Build a lookup for payees by name
  const payeeLookup = useMemo(() => {
    const lookup = new Map<string, Payee>();
    payees.forEach((p) => {
      lookup.set(p.name.toLowerCase(), p);
    });
    return lookup;
  }, [payees]);

  // Build preview transactions with duplicate detection and payee/category mapping
  const previewTransactions = useMemo((): PreviewTransaction[] => {
    // Build mapping lookup: originalPayee -> { payeeId, payeeName, lastCategoryId }
    const mappingLookup = new Map<string, { payeeId: string; payeeName: string; lastCategoryId: string | null }>();
    payeeMappings?.forEach((m) => {
      mappingLookup.set(m.originalPayee, {
        payeeId: m.payeeId,
        payeeName: m.payeeName,
        lastCategoryId: m.lastCategoryId,
      });
    });

    return transactions.map((t) => {
      const isDuplicate = existingTransactions.some(
        (existing) => existing.date === t.date && existing.amount === t.amount
      );

      const originalPayee = t.payee || '';
      // Check for user edits first, then existing mappings
      const edit = payeeEdits[originalPayee];
      const mapping = mappingLookup.get(originalPayee);

      let displayPayee: string;
      let displayPayeeId: string | null;
      let displayCategoryId: string | null;

      if (edit) {
        // User has edited this payee
        displayPayee = edit.payeeName;
        displayPayeeId = edit.payeeId;
        displayCategoryId = edit.categoryId;
      } else if (mapping) {
        // Existing mapping from previous imports
        displayPayee = mapping.payeeName;
        displayPayeeId = mapping.payeeId;
        displayCategoryId = mapping.lastCategoryId;
      } else {
        // No mapping - use original payee, check if it exists in payee table
        displayPayee = originalPayee;
        const existingPayee = payeeLookup.get(originalPayee.toLowerCase());
        displayPayeeId = existingPayee?.id ?? null;
        displayCategoryId = existingPayee?.lastCategoryId ?? null;
      }

      const isMapped = displayPayee !== originalPayee || displayCategoryId !== null;

      return {
        ...t,
        isDuplicate,
        originalPayee,
        displayPayee,
        displayPayeeId,
        displayCategoryId,
        isMapped,
      };
    });
  }, [transactions, existingTransactions, payeeMappings, payeeEdits, payeeLookup]);

  const newTransactions = previewTransactions.filter((t, index) => !t.isDuplicate && !excludedIndices.has(index));
  const duplicateCount = previewTransactions.filter((t) => t.isDuplicate).length;
  const excludedCount = excludedIndices.size;

  const toggleExcluded = (index: number) => {
    setExcludedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handlePayeeChange = (originalPayee: string, newPayeeName: string, lastCategoryId: string | null) => {
    // Check if this payee already exists in the payee table
    const existingPayee = payeeLookup.get(newPayeeName.toLowerCase());

    setPayeeEdits((prev) => ({
      ...prev,
      [originalPayee]: {
        payeeName: newPayeeName,
        payeeId: existingPayee?.id ?? null, // null = new payee to be created
        // Use the payee's lastCategoryId if we selected an existing payee
        // Otherwise, preserve any manually set category or use the one passed in
        categoryId: existingPayee ? (existingPayee.lastCategoryId ?? prev[originalPayee]?.categoryId ?? null) : (lastCategoryId ?? prev[originalPayee]?.categoryId ?? null),
      },
    }));
  };

  const handleCategoryChange = (originalPayee: string, categoryId: string | null) => {
    setPayeeEdits((prev) => {
      const existing = prev[originalPayee];
      // Get the current display payee for this original payee
      const mapping = payeeMappings?.find((m) => m.originalPayee === originalPayee);
      const currentPayeeName = existing?.payeeName ?? mapping?.payeeName ?? originalPayee;
      const currentPayeeId = existing?.payeeId ?? mapping?.payeeId ?? payeeLookup.get(originalPayee.toLowerCase())?.id ?? null;

      return {
        ...prev,
        [originalPayee]: {
          payeeName: currentPayeeName,
          payeeId: currentPayeeId,
          categoryId,
        },
      };
    });
    setEditingField(null);
  };

  const handleEditComplete = () => {
    setEditingField(null);
  };

  const handleImport = async () => {
    // Collect all payee names that need to be created
    const newPayeeNames = new Set<string>();
    // Collect all mappings to save after payees are created
    const mappingsToSave: Array<{ originalPayee: string; payeeName: string; payeeId: string | null }> = [];

    // Get unique original payees from transactions we're importing
    const originalPayees = new Set(newTransactions.map((t) => t.originalPayee));

    for (const originalPayee of originalPayees) {
      if (!originalPayee) continue;

      const edit = payeeEdits[originalPayee];
      const existingMapping = payeeMappings?.find((m) => m.originalPayee === originalPayee);

      let payeeName: string;
      let payeeId: string | null;

      if (edit) {
        payeeName = edit.payeeName;
        payeeId = edit.payeeId;
      } else if (existingMapping) {
        payeeName = existingMapping.payeeName;
        payeeId = existingMapping.payeeId;
      } else {
        payeeName = originalPayee;
        payeeId = payeeLookup.get(originalPayee.toLowerCase())?.id ?? null;
      }

      // Only save if there's a meaningful mapping (payee changed from original)
      if (payeeName !== originalPayee) {
        if (payeeId === null) {
          newPayeeNames.add(payeeName);
        }
        mappingsToSave.push({ originalPayee, payeeName, payeeId });
      }
    }

    // Create new payees first
    const createdPayees = new Map<string, string>(); // name -> id
    for (const name of newPayeeNames) {
      try {
        const payee = await createPayee.mutateAsync(name);
        createdPayees.set(name, payee.id);
      } catch (error) {
        console.error(`Failed to create payee "${name}":`, error);
      }
    }

    // Save mappings with resolved payee IDs
    for (const mapping of mappingsToSave) {
      const payeeId = mapping.payeeId ?? createdPayees.get(mapping.payeeName);
      if (payeeId) {
        createPayeeMapping.mutate({ originalPayee: mapping.originalPayee, payeeId });
      }
    }

    // Prepare transactions with mapped payees and categories
    const items = newTransactions.map((t) => ({
      date: t.date,
      amount: t.amount,
      payee: t.displayPayee || undefined,
      memo: t.memo || undefined,
      categoryId: t.displayCategoryId || undefined,
    }));

    if (items.length === 0) {
      onImportComplete(0, duplicateCount);
      return;
    }

    importTransactions.mutate(
      { accountId, transactions: items },
      {
        onSuccess: (result) => {
          onImportComplete(result.imported, result.skipped + duplicateCount);
        },
      }
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (mappingsLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold">Import Transactions</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <p className="text-sm text-gray-700">
            <span className="font-medium">{newTransactions.length} transaction{newTransactions.length !== 1 ? 's' : ''}</span> will
            be imported into <span className="font-medium">{accountName}</span>
            {(duplicateCount > 0 || excludedCount > 0) && (
              <span className="text-gray-500">
                {' '}(
                {duplicateCount > 0 && `${duplicateCount} duplicate${duplicateCount !== 1 ? 's' : ''}`}
                {duplicateCount > 0 && excludedCount > 0 && ', '}
                {excludedCount > 0 && `${excludedCount} excluded`}
                {' '}will be skipped)
              </span>
            )}
          </p>
        </div>

        {/* Preview Table */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Preview</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-2 font-medium w-8"></th>
                <th className="py-2 pr-4 font-medium">DATE</th>
                <th className="py-2 pr-4 font-medium">PAYEE</th>
                <th className="py-2 pr-4 font-medium">CATEGORY</th>
                <th className="py-2 pr-4 font-medium">MEMO</th>
                <th className="py-2 pr-4 font-medium text-right">OUTFLOW</th>
                <th className="py-2 font-medium text-right">INFLOW</th>
              </tr>
            </thead>
            <tbody>
              {previewTransactions.map((t, index) => {
                const isExcluded = excludedIndices.has(index);
                const isSkipped = t.isDuplicate || isExcluded;

                return (
                <tr
                  key={index}
                  className={`border-b border-gray-100 ${isSkipped ? 'opacity-50' : ''}`}
                >
                  <td className="py-2 pr-2">
                    {!t.isDuplicate && (
                      <input
                        type="checkbox"
                        checked={!isExcluded}
                        onChange={() => toggleExcluded(index)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    )}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <span className={isSkipped ? 'line-through' : ''}>
                      {formatDate(t.date)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 max-w-[180px]">
                    {editingField?.index === index && editingField?.field === 'payee' && !isSkipped ? (
                      <PayeeSelect
                        value={t.displayPayee}
                        onChange={(name, lastCategoryId) => handlePayeeChange(t.originalPayee, name, lastCategoryId)}
                        onCancel={handleEditComplete}
                        onBlur={handleEditComplete}
                        autoFocus
                        className="text-sm py-1"
                        placeholder="Payee"
                      />
                    ) : (
                      <span
                        onClick={() => !isSkipped && setEditingField({ index, field: 'payee' })}
                        className={`truncate block ${isSkipped ? 'line-through' : 'cursor-pointer hover:bg-blue-50 px-1 -mx-1 rounded'}`}
                        title={t.isMapped && t.displayPayee !== t.originalPayee ? `Original: ${t.originalPayee}` : undefined}
                      >
                        {t.displayPayee || '-'}
                        {t.isMapped && t.displayPayee !== t.originalPayee && !isSkipped && (
                          <span className="ml-1 text-blue-500 text-xs">*</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 max-w-[150px]">
                    {editingField?.index === index && editingField?.field === 'category' && !isSkipped ? (
                      <CategorySelect
                        value={t.displayCategoryId}
                        onChange={(categoryId) => handleCategoryChange(t.originalPayee, categoryId)}
                        onCancel={handleEditComplete}
                        allowNull
                        autoFocus
                        className="text-sm"
                      />
                    ) : (
                      <span
                        onClick={() => !isSkipped && setEditingField({ index, field: 'category' })}
                        className={`truncate block text-gray-600 ${isSkipped ? 'line-through' : 'cursor-pointer hover:bg-blue-50 px-1 -mx-1 rounded'}`}
                      >
                        {t.displayCategoryId ? categoryNameLookup.get(t.displayCategoryId) || '-' : '-'}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 truncate max-w-[120px] text-gray-500" title={t.memo}>
                    <span className={isSkipped ? 'line-through' : ''}>
                      {t.memo || '-'}
                    </span>
                  </td>
                  <td className={`py-2 pr-4 text-right ${isSkipped ? 'line-through' : ''} ${t.amount < 0 ? 'text-red-600' : ''}`}>
                    {t.amount < 0 ? formatNOK(Math.abs(t.amount)) : ''}
                  </td>
                  <td className={`py-2 text-right ${isSkipped ? 'line-through' : ''} ${t.amount > 0 ? 'text-green-600' : ''}`}>
                    {t.amount > 0 ? formatNOK(t.amount) : ''}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={importTransactions.isPending}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={importTransactions.isPending || newTransactions.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {importTransactions.isPending ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportPreviewModal;
