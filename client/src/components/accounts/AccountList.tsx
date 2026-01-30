import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAccounts } from '@/hooks/queries/useAccounts';
import { formatNOK } from '@/utils/currency';
import AddAccountModal from './AddAccountModal';

function AccountList() {
  const { accountId } = useParams();
  const { data: accounts, isLoading } = useAccounts();
  const [showModal, setShowModal] = useState(false);

  if (isLoading) {
    return (
      <div className="p-4">
        <p className="text-slate-400 text-sm">Loading accounts...</p>
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Accounts
        </span>
        <button
          onClick={() => setShowModal(true)}
          className="p-1 text-slate-400 hover:text-white rounded transition-colors"
          title="Add account"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-1">
        {accounts?.map((account) => (
          <Link
            key={account.id}
            to={`/accounts/${account.id}`}
            className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
              accountId === account.id
                ? 'bg-slate-700 text-white'
                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <span className="truncate">{account.name}</span>
            <span className={`text-sm ${account.balance < 0 ? 'text-red-400' : 'text-slate-400'}`}>
              {formatNOK(account.balance)}
            </span>
          </Link>
        ))}

        {(!accounts || accounts.length === 0) && (
          <p className="px-3 py-2 text-slate-400 text-sm">No accounts yet</p>
        )}
      </div>

      {showModal && <AddAccountModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

export default AccountList;
