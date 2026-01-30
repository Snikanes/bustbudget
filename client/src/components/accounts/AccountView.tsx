import { useParams } from 'react-router-dom';
import { useAccount } from '@/hooks/queries/useAccounts';
import { useTransactions } from '@/hooks/queries/useTransactions';
import { formatNOK } from '@/utils/currency';
import TransactionTable from './TransactionTable';

function AccountView() {
  const { accountId } = useParams<{ accountId: string }>();
  const { data: account, isLoading: accountLoading } = useAccount(accountId!);
  const { data: transactions, isLoading: transactionsLoading } = useTransactions(accountId!);

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
          <h1 className="text-xl font-semibold">{account.name}</h1>
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
      </header>

      {/* Transactions */}
      <div className="flex-1 overflow-auto p-6">
        <TransactionTable
          accountId={accountId!}
          transactions={transactions || []}
        />
      </div>
    </div>
  );
}

export default AccountView;
