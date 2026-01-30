import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { useCreateTransaction } from '@/hooks/queries/useTransactions';
import { useCategories } from '@/hooks/queries/useCategories';

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
  const { data: categories } = useCategories();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const outflowAmount = parseFloat(outflow.replace(',', '.')) * 100 || 0;
    const inflowAmount = parseFloat(inflow.replace(',', '.')) * 100 || 0;
    const amount = inflowAmount - outflowAmount;

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
            <input
              type="text"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              placeholder="Who did you pay?"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select category...</option>
              {categories?.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
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
              disabled={createTransaction.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {createTransaction.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TransactionModal;
