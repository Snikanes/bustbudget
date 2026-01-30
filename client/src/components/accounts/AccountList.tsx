import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAccounts, useUpdateAccount } from '@/hooks/queries/useAccounts';
import { formatNOK } from '@/utils/currency';
import AddAccountModal from './AddAccountModal';
import TextInput from '@/components/shared/TextInput';

function AccountList() {
  const { accountId } = useParams();
  const { data: accounts, isLoading } = useAccounts();
  const [showModal, setShowModal] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const updateAccount = useUpdateAccount();

  const handleNameChange = (accountId: string, newName: string) => {
    if (newName) {
      updateAccount.mutate({
        id: accountId,
        name: newName,
      });
    }
    setEditingAccountId(null);
  };

  const validateName = (name: string) => {
    return name.trim().length > 0 && name.trim().length <= 100;
  };

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
            {editingAccountId === account.id ? (
              <div onClick={(e) => e.stopPropagation()}>
                <TextInput
                  value={account.name}
                  onChange={(newName) => handleNameChange(account.id, newName)}
                  onCancel={() => setEditingAccountId(null)}
                  validate={validateName}
                  autoFocus
                  selectAllOnFocus
                  className="bg-slate-800 text-white text-sm px-2 py-1"
                />
              </div>
            ) : (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setEditingAccountId(account.id);
                }}
                className="truncate cursor-pointer hover:bg-slate-600 px-2 -mx-2 rounded transition-colors"
              >
                {account.name}
              </span>
            )}
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
