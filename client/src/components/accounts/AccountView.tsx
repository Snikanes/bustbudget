import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Upload, CheckCircle } from 'lucide-react';
import { useAccount, useUpdateAccount } from '@/hooks/queries/useAccounts';
import { useTransactions } from '@/hooks/queries/useTransactions';
import { formatNOK } from '@/utils/currency';
import { parseQFX, ParsedTransaction } from '@/utils/qfxParser';
import { parseExcel } from '@/utils/excelParser';
import { parseCSV } from '@/utils/csvParser';
import TransactionTable from './TransactionTable';
import TextInput from '@/components/shared/TextInput';
import FileImportModal, { ImportedFile } from './FileImportModal';
import ImportPreviewModal from './ImportPreviewModal';
import ReconcileModal from './ReconcileModal';

function AccountView() {
  const { accountId } = useParams<{ accountId: string }>();
  const { data: account, isLoading: accountLoading } = useAccount(accountId!);
  const { data: transactions, isLoading: transactionsLoading } = useTransactions(accountId!);
  const [isEditingName, setIsEditingName] = useState(false);
  const updateAccount = useUpdateAccount();

  // Import state
  const [showFileImport, setShowFileImport] = useState(false);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  // Reconcile state
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<number | null>(null);

  const handleNameChange = (newName: string) => {
    if (newName && newName !== account?.name) {
      updateAccount.mutate({
        id: accountId!,
        name: newName,
      });
    }
    setIsEditingName(false);
  };

  const validateName = (name: string) => {
    return name.trim().length > 0 && name.trim().length <= 100;
  };

  const handleFileSelected = (file: ImportedFile) => {
    setShowFileImport(false);
    setImportError(null);

    let result;
    if (file.type === 'excel') {
      result = parseExcel(file.content as ArrayBuffer);
    } else if (file.type === 'csv') {
      result = parseCSV(file.content as string);
    } else {
      result = parseQFX(file.content as string);
    }

    if (result.error) {
      setImportError(result.error);
      return;
    }

    setParsedTransactions(result.transactions);
  };

  const handleImportComplete = (imported: number, skipped: number) => {
    setParsedTransactions(null);
    setImportResult({ imported, skipped });
    // Auto-dismiss after 5 seconds
    setTimeout(() => setImportResult(null), 5000);
  };

  const handleCloseImportPreview = () => {
    setParsedTransactions(null);
  };

  const handleReconcileSuccess = (reconciledCount: number) => {
    setReconcileResult(reconciledCount);
    // Auto-dismiss after 5 seconds
    setTimeout(() => setReconcileResult(null), 5000);
  };

  if (accountLoading || transactionsLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-gray-200 rounded mb-4" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-6">
        <div className="text-red-600">Account not found</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {isEditingName ? (
              <TextInput
                value={account.name}
                onChange={handleNameChange}
                onCancel={() => setIsEditingName(false)}
                validate={validateName}
                autoFocus
                selectAllOnFocus
                className="text-xl font-semibold"
              />
            ) : (
              <h1
                onClick={() => setIsEditingName(true)}
                className="text-xl font-semibold cursor-pointer hover:bg-gray-100 px-2 -mx-2 rounded transition-colors"
              >
                {account.name}
              </h1>
            )}
            <button
              onClick={() => setShowFileImport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
            <button
              onClick={() => setShowReconcileModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Reconcile
            </button>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Balance</div>
            <div className={`text-xl font-semibold ${
              account.balance < 0 ? 'text-red-600' : 'text-gray-900'
            }`}>
              {formatNOK(account.balance)}
            </div>
          </div>
        </div>
        <div className="mt-2 flex gap-4 text-sm text-gray-500">
          <span>Cleared: {formatNOK(account.clearedBalance)}</span>
          <span>Uncleared: {formatNOK(account.unclearedBalance)}</span>
        </div>

        {/* Import result notification */}
        {importResult && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            Successfully imported {importResult.imported} transaction{importResult.imported !== 1 ? 's' : ''}.
            {importResult.skipped > 0 && ` ${importResult.skipped} duplicate${importResult.skipped !== 1 ? 's' : ''} skipped.`}
          </div>
        )}

        {/* Reconcile result notification */}
        {reconcileResult !== null && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            Successfully reconciled {reconcileResult} transaction{reconcileResult !== 1 ? 's' : ''}.
          </div>
        )}

        {/* Import error notification */}
        {importError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center justify-between">
            <span>{importError}</span>
            <button
              onClick={() => setImportError(null)}
              className="text-red-600 hover:text-red-800"
            >
              Dismiss
            </button>
          </div>
        )}
      </header>

      {/* Transactions */}
      <div className="flex-1 overflow-auto p-6">
        <TransactionTable
          accountId={accountId!}
          transactions={transactions || []}
        />
      </div>

      {/* File Import Modal */}
      {showFileImport && (
        <FileImportModal
          onClose={() => setShowFileImport(false)}
          onFileSelected={handleFileSelected}
        />
      )}

      {/* Import Preview Modal */}
      {parsedTransactions && (
        <ImportPreviewModal
          accountId={accountId!}
          accountName={account.name}
          transactions={parsedTransactions}
          existingTransactions={transactions || []}
          onClose={handleCloseImportPreview}
          onImportComplete={handleImportComplete}
        />
      )}

      {/* Reconcile Modal */}
      {showReconcileModal && (
        <ReconcileModal
          accountId={accountId!}
          clearedBalance={account.clearedBalance}
          onClose={() => setShowReconcileModal(false)}
          onSuccess={handleReconcileSuccess}
        />
      )}
    </div>
  );
}

export default AccountView;
