import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { ParsedTransaction } from '@/utils/qfxParser';
import { Transaction } from '@/types';
import { formatNOK } from '@/utils/currency';
import { useImportTransactions } from '@/hooks/queries/useTransactions';
import { useImportPayeeMappings, useCreateImportPayeeMapping } from '@/hooks/queries/useImportPayeeMappings';
import { useCategoryGroups } from '@/hooks/queries/useCategories';
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
  displayCategoryId: string | null;
  isMapped: boolean;
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
  const { data: categoryGroups } = useCategoryGroups();
  const createPayeeMapping = useCreateImportPayeeMapping();

  // Track edits by originalPayee -> { payee, categoryId }
  const [payeeEdits, setPayeeEdits] = useState<Record<string, { payee: string; categoryId: string | null }>>({});
  const [editingField, setEditingField] = useState<EditingField>(null);

  // Build a lookup for category names
  const categoryNameLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    categoryGroups?.forEach((group) => {
      group.categories.forEach((cat) => {
        lookup.set(cat.id, cat.name);
      });
    });
    return lookup;
  }, [categoryGroups]);

  // Build preview transactions with duplicate detection and payee/category mapping
  const previewTransactions = useMemo((): PreviewTransaction[] => {
    const mappingLookup = new Map<string, { payee: string; categoryId: string | null }>();
    payeeMappings?.forEach((m) => {
      mappingLookup.set(m.originalPayee, { payee: m.mappedPayee, categoryId: m.categoryId });
    });

    return transactions.map((t) => {
      const isDuplicate = existingTransactions.some(
        (existing) => existing.date === t.date && existing.amount === t.amount
      );

      const originalPayee = t.payee || '';
      // Check for user edits first, then existing mappings
      const edit = payeeEdits[originalPayee];
      const mapping = mappingLookup.get(originalPayee);

      const displayPayee = edit?.payee ?? mapping?.payee ?? originalPayee;
      const displayCategoryId = edit?.categoryId !== undefined ? edit.categoryId : (mapping?.categoryId ?? null);
      const isMapped = displayPayee !== originalPayee || displayCategoryId !== null;

      return {
        ...t,
        isDuplicate,
        originalPayee,
        displayPayee,
        displayCategoryId,
        isMapped,
      };
    });
  }, [transactions, existingTransactions, payeeMappings, payeeEdits]);

  const newTransactions = previewTransactions.filter((t) => !t.isDuplicate);
  const duplicateCount = previewTransactions.length - newTransactions.length;

  const handlePayeeChange = (originalPayee: string, newPayee: string) => {
    setPayeeEdits((prev) => ({
      ...prev,
      [originalPayee]: {
        payee: newPayee,
        categoryId: prev[originalPayee]?.categoryId ?? null,
      },
    }));
  };

  const handleCategoryChange = (originalPayee: string, categoryId: string | null) => {
    setPayeeEdits((prev) => {
      const existing = prev[originalPayee];
      // Get the current display payee for this original payee
      const mapping = payeeMappings?.find((m) => m.originalPayee === originalPayee);
      const currentPayee = existing?.payee ?? mapping?.mappedPayee ?? originalPayee;

      return {
        ...prev,
        [originalPayee]: {
          payee: currentPayee,
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
    // Collect all mappings to save (both from edits and to update categories)
    const mappingsToSave: Array<{ originalPayee: string; mappedPayee: string; categoryId: string | null }> = [];

    // Get unique original payees from transactions we're importing
    const originalPayees = new Set(newTransactions.map((t) => t.originalPayee));

    for (const originalPayee of originalPayees) {
      if (!originalPayee) continue;

      const edit = payeeEdits[originalPayee];
      const existingMapping = payeeMappings?.find((m) => m.originalPayee === originalPayee);

      const mappedPayee = edit?.payee ?? existingMapping?.mappedPayee ?? originalPayee;
      const categoryId = edit?.categoryId !== undefined ? edit.categoryId : (existingMapping?.categoryId ?? null);

      // Only save if there's a meaningful mapping (payee changed or category set)
      if (mappedPayee !== originalPayee || categoryId !== null) {
        mappingsToSave.push({ originalPayee, mappedPayee, categoryId });
      }
    }

    // Save mappings (fire and forget - don't block import)
    for (const mapping of mappingsToSave) {
      createPayeeMapping.mutate(mapping);
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
            {duplicateCount > 0 && (
              <span className="text-gray-500">
                {' '}({duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''} will be skipped)
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
                <th className="py-2 pr-4 font-medium">DATE</th>
                <th className="py-2 pr-4 font-medium">PAYEE</th>
                <th className="py-2 pr-4 font-medium">CATEGORY</th>
                <th className="py-2 pr-4 font-medium">MEMO</th>
                <th className="py-2 pr-4 font-medium text-right">OUTFLOW</th>
                <th className="py-2 font-medium text-right">INFLOW</th>
              </tr>
            </thead>
            <tbody>
              {previewTransactions.map((t, index) => (
                <tr
                  key={index}
                  className={`border-b border-gray-100 ${t.isDuplicate ? 'opacity-50' : ''}`}
                >
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <span className={t.isDuplicate ? 'line-through' : ''}>
                      {formatDate(t.date)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 max-w-[180px]">
                    {editingField?.index === index && editingField?.field === 'payee' && !t.isDuplicate ? (
                      <PayeeSelect
                        value={t.displayPayee}
                        onChange={(name) => handlePayeeChange(t.originalPayee, name)}
                        onCancel={handleEditComplete}
                        onBlur={handleEditComplete}
                        autoFocus
                        className="text-sm py-1"
                        placeholder="Payee"
                      />
                    ) : (
                      <span
                        onClick={() => !t.isDuplicate && setEditingField({ index, field: 'payee' })}
                        className={`truncate block ${t.isDuplicate ? 'line-through' : 'cursor-pointer hover:bg-blue-50 px-1 -mx-1 rounded'}`}
                        title={t.isMapped && t.displayPayee !== t.originalPayee ? `Original: ${t.originalPayee}` : undefined}
                      >
                        {t.displayPayee || '-'}
                        {t.isMapped && t.displayPayee !== t.originalPayee && !t.isDuplicate && (
                          <span className="ml-1 text-blue-500 text-xs">*</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 max-w-[150px]">
                    {editingField?.index === index && editingField?.field === 'category' && !t.isDuplicate ? (
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
                        onClick={() => !t.isDuplicate && setEditingField({ index, field: 'category' })}
                        className={`truncate block text-gray-600 ${t.isDuplicate ? 'line-through' : 'cursor-pointer hover:bg-blue-50 px-1 -mx-1 rounded'}`}
                      >
                        {t.displayCategoryId ? categoryNameLookup.get(t.displayCategoryId) || '-' : '-'}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 truncate max-w-[120px] text-gray-500" title={t.memo}>
                    <span className={t.isDuplicate ? 'line-through' : ''}>
                      {t.memo || '-'}
                    </span>
                  </td>
                  <td className={`py-2 pr-4 text-right ${t.isDuplicate ? 'line-through' : ''} ${t.amount < 0 ? 'text-red-600' : ''}`}>
                    {t.amount < 0 ? formatNOK(Math.abs(t.amount)) : ''}
                  </td>
                  <td className={`py-2 text-right ${t.isDuplicate ? 'line-through' : ''} ${t.amount > 0 ? 'text-green-600' : ''}`}>
                    {t.amount > 0 ? formatNOK(t.amount) : ''}
                  </td>
                </tr>
              ))}
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
