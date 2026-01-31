import { X } from 'lucide-react';
import { formatNOK } from '@/utils/currency';
import { useReconcileAccount } from '@/hooks/queries/useTransactions';

interface ReconcileModalProps {
  accountId: string;
  clearedBalance: number;
  onClose: () => void;
  onSuccess: (reconciledCount: number) => void;
}

function ReconcileModal({ accountId, clearedBalance, onClose, onSuccess }: ReconcileModalProps) {
  const reconcileAccount = useReconcileAccount();

  const handleReconcile = () => {
    reconcileAccount.mutate(accountId, {
      onSuccess: (result) => {
        onSuccess(result.reconciledCount);
        onClose();
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Reconcile Account</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-gray-700">
            Is your current cleared balance:
          </p>
          <p className={`text-2xl font-semibold text-center ${
            clearedBalance < 0 ? 'text-red-600' : 'text-gray-900'
          }`}>
            {formatNOK(clearedBalance)}
          </p>
          <p className="text-sm text-gray-500">
            Clicking "Yes" will mark all cleared transactions as reconciled.
            Reconciled transactions cannot be changed.
          </p>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              No
            </button>
            <button
              type="button"
              onClick={handleReconcile}
              disabled={reconcileAccount.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {reconcileAccount.isPending ? 'Reconciling...' : 'Yes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReconcileModal;
