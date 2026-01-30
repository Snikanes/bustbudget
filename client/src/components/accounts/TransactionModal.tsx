import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { useCreateTransaction, useCreateTransfer } from '@/hooks/queries/useTransactions';
import { useCategoryGroups } from '@/hooks/queries/useCategories';
import { useAccounts } from '@/hooks/queries/useAccounts';
import PayeeSelect from '@/components/shared/PayeeSelect';

interface TransactionModalProps {
  accountId: string;
  onClose: () => void;
}

function TransactionModal({ accountId, onClose }: TransactionModalProps) {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [payee, setPayee] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [memo, setMemo] = useState('');
  const [outflow, setOutflow] = useState('');
  const [inflow, setInflow] = useState('');
  const [isCleared, setIsCleared] = useState(false);

  const createTransaction = useCreateTransaction();
  const createTransfer = useCreateTransfer();
  const { data: categoryGroups } = useCategoryGroups();
  const { data: accounts } = useAccounts();

  // Filter accounts for transfer options
  const transferAccounts = accounts
    ?.filter(account => !account.isClosed && account.id !== accountId)
    .sort((a, b) => a.name.localeCompare(b.name)) || [];

  // Check if transfer is selected and get destination account
  const isTransferSelected = categoryId && categoryId.startsWith('transfer:');
  const destinationAccountId = isTransferSelected ? categoryId.replace('transfer:', '') : null;
  const destinationAccount = destinationAccountId
    ? accounts?.find(acc => acc.id === destinationAccountId)
    : null;
  const transferPayee = destinationAccount ? `Transfer: ${destinationAccount.name}` : '';

  const handlePayeeChange = (name: string, lastCategoryId: string | null) => {
    setPayee(name);
    // Auto-fill category if payee has a remembered category and no category is selected
    if (lastCategoryId && !categoryId) {
      setCategoryId(lastCategoryId);
    }
  };

  const handleCategoryChange = (value: string) => {
    const wasTransfer = Boolean(categoryId && categoryId.startsWith('transfer:'));
    const isNowTransfer = Boolean(value && value.startsWith('transfer:'));

    // Clear payee when switching to/from transfer
    if (wasTransfer !== isNowTransfer) {
      setPayee('');
    }

    setCategoryId(value);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const outflowAmount = parseFloat(outflow.replace(',', '.')) * 100 || 0;
    const inflowAmount = parseFloat(inflow.replace(',', '.')) * 100 || 0;
    const amount = inflowAmount - outflowAmount;

    // Check if a transfer was selected
    if (categoryId && categoryId.startsWith('transfer:')) {
      const targetAccountId = categoryId.replace('transfer:', '');
      const transferAmount = Math.abs(amount);

      // Determine direction based on amount sign
      const fromAccountId = amount < 0 ? accountId : targetAccountId;
      const toAccountId = amount < 0 ? targetAccountId : accountId;

      createTransfer.mutate(
        {
          fromAccountId,
          toAccountId,
          amount: transferAmount,
          date,
          memo: memo || undefined,
          isCleared,
        },
        {
          onSuccess: () => {
            onClose();
          },
        }
      );
    } else {
      // Create regular transaction
      createTransaction.mutate(
        {
          accountId,
          date,
          amount,
          payee: payee || undefined,
          categoryId: categoryId || undefined,
          memo: memo || undefined,
          isCleared,
        },
        {
          onSuccess: () => {
            onClose();
          },
        }
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold">New Transaction</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Payee */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payee
            </label>
            <PayeeSelect
              value={isTransferSelected ? transferPayee : payee}
              onChange={handlePayeeChange}
              disabled={!!isTransferSelected}
              placeholder="Who did you pay?"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select category...</option>

              {categoryGroups?.map((group) => (
                <optgroup key={group.id} label={group.name}>
                  {group.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              ))}

              {transferAccounts.length > 0 && (
                <optgroup label="Transfers">
                  {transferAccounts.map((account) => (
                    <option key={account.id} value={`transfer:${account.id}`}>
                      Transfer: {account.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Memo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Memo
            </label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Add a note..."
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Outflow
              </label>
              <input
                type="text"
                value={outflow}
                onChange={(e) => {
                  setOutflow(e.target.value);
                  if (e.target.value) setInflow('');
                }}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-red-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Inflow
              </label>
              <input
                type="text"
                value={inflow}
                onChange={(e) => {
                  setInflow(e.target.value);
                  if (e.target.value) setOutflow('');
                }}
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-green-600"
              />
            </div>
          </div>

          {/* Cleared */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="cleared"
              checked={isCleared}
              onChange={(e) => setIsCleared(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="cleared" className="text-sm text-gray-700">
              Cleared
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTransaction.isPending || createTransfer.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {createTransaction.isPending || createTransfer.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TransactionModal;
