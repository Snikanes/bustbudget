import { useMemo } from 'react';
import { X } from 'lucide-react';
import { ParsedTransaction } from '@/utils/qfxParser';
import { Transaction } from '@/types';
import { formatNOK } from '@/utils/currency';
import { useImportTransactions } from '@/hooks/queries/useTransactions';

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
}

function ImportPreviewModal({
  accountId,
  accountName,
  transactions,
  existingTransactions,
  onClose,
  onImportComplete,
}: ImportPreviewModalProps) {
  const importTransactions = useImportTransactions();

  // Check for duplicates based on date + amount
  const previewTransactions = useMemo((): PreviewTransaction[] => {
    return transactions.map((t) => {
      const isDuplicate = existingTransactions.some(
        (existing) => existing.date === t.date && existing.amount === t.amount
      );
      return { ...t, isDuplicate };
    });
  }, [transactions, existingTransactions]);

  const newTransactions = previewTransactions.filter((t) => !t.isDuplicate);
  const duplicateCount = previewTransactions.length - newTransactions.length;

  const handleImport = () => {
    // Only import non-duplicate transactions
    const items = newTransactions.map((t) => ({
      date: t.date,
      amount: t.amount,
      payee: t.payee || undefined,
      memo: t.memo || undefined,
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
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
                  <td className="py-2 pr-4 truncate max-w-[150px]" title={t.payee}>
                    <span className={t.isDuplicate ? 'line-through' : ''}>
                      {t.payee || '-'}
                    </span>
                  </td>
                  <td className="py-2 pr-4 truncate max-w-[150px] text-gray-500" title={t.memo}>
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
            disabled={importTransactions.isPending}
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
