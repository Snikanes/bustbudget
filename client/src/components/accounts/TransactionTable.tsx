import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Transaction } from '@/types';
import TransactionRow from './TransactionRow';
import TransactionModal from './TransactionModal';

interface TransactionTableProps {
  accountId: string;
  transactions: Transaction[];
}

function TransactionTable({ accountId, transactions }: TransactionTableProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-semibold">Transactions</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Transaction
        </button>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[100px_1fr_1fr_1fr_120px_120px_40px_40px] gap-2 px-4 py-2 border-b border-gray-200 bg-gray-50 text-sm font-medium text-gray-600">
        <div>Date</div>
        <div>Payee</div>
        <div>Category</div>
        <div>Memo</div>
        <div className="text-right">Outflow</div>
        <div className="text-right">Inflow</div>
        <div className="text-center">C</div>
        <div></div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100">
        {transactions.map((transaction) => (
          <TransactionRow
            key={transaction.id}
            transaction={transaction}
            currentAccountId={accountId}
          />
        ))}

        {transactions.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-500">
            No transactions yet
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <TransactionModal
          accountId={accountId}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

export default TransactionTable;
