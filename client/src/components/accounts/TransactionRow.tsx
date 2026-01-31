import { useState, useRef, useEffect } from 'react';
import { Check, Circle, Trash2, Lock } from 'lucide-react';
import { Transaction } from '@/types';
import { formatNOK } from '@/utils/currency';
import { useUpdateTransaction, useDeleteTransaction, useCreateTransfer } from '@/hooks/queries/useTransactions';
import DateInput from '@/components/shared/DateInput';
import CategorySelect from '@/components/shared/CategorySelect';
import CurrencyInput from '@/components/shared/CurrencyInput';
import TextInput from '@/components/shared/TextInput';
import PayeeSelect from '@/components/shared/PayeeSelect';

interface TransactionRowProps {
  transaction: Transaction;
  currentAccountId: string;
}

type EditingField = 'date' | 'payee' | 'category' | 'outflow' | 'inflow' | 'memo' | null;

function TransactionRow({ transaction, currentAccountId }: TransactionRowProps) {
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [isSelected, setIsSelected] = useState(false);
  const [tempPayee, setTempPayee] = useState('');
  const rowRef = useRef<HTMLDivElement>(null);
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const createTransfer = useCreateTransfer();

  const isCleared = transaction.isCleared;
  const isReconciled = transaction.isReconciled;
  const isTransfer = transaction.transferId !== null;
  const isStartingBalance = transaction.isStartingBalance;

  // Field-level editability
  // Reconciled: only memo editable, cannot toggle cleared
  // Cleared: only memo and isCleared editable
  const canEditDate = !isCleared;
  const canEditPayee = !isCleared;
  const canEditCategory = !isCleared && !isTransfer;
  const canEditAmount = !isCleared; // Allow editing for all uncleared transactions
  const canEditMemo = true; // Always editable
  const canToggleCleared = !isReconciled; // Cannot un-reconcile

  // Handle click outside to deselect
  useEffect(() => {
    if (!isSelected) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(event.target as Node)) {
        setIsSelected(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSelected]);

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't select if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) {
      return;
    }
    setIsSelected(true);
  };

  const handleClearedToggle = () => {
    updateTransaction.mutate({
      id: transaction.id,
      isCleared: !transaction.isCleared,
    });
  };

  const handleOutflowChange = (value: number) => {
    const newAmount = -Math.abs(value); // Always negative
    updateTransaction.mutate({ id: transaction.id, amount: newAmount });
    setEditingField(null);
  };

  const handleInflowChange = (value: number) => {
    const newAmount = Math.abs(value); // Always positive
    updateTransaction.mutate({ id: transaction.id, amount: newAmount });
    setEditingField(null);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      deleteTransaction.mutate(transaction.id);
    }
  };

  const handleCategoryChange = (value: string | null) => {
    if (value && value.startsWith('transfer:')) {
      const targetAccountId = value.replace('transfer:', '');
      handleConvertToTransfer(targetAccountId);
    } else {
      updateTransaction.mutate({ id: transaction.id, categoryId: value });
      setEditingField(null);
    }
  };

  const handleConvertToTransfer = (targetAccountId: string) => {
    const amount = Math.abs(transaction.amount);

    // Determine direction based on transaction sign
    const fromAccountId = transaction.amount < 0 ? currentAccountId : targetAccountId;
    const toAccountId = transaction.amount < 0 ? targetAccountId : currentAccountId;

    // Delete transaction, then create transfer
    deleteTransaction.mutate(transaction.id, {
      onSuccess: () => {
        createTransfer.mutate(
          {
            fromAccountId,
            toAccountId,
            amount,
            date: transaction.date,
            memo: transaction.memo || undefined,
            isCleared: transaction.isCleared,
          },
          {
            onError: (error) => {
              console.error('Failed to create transfer:', error);
              alert('Transaction was deleted but transfer creation failed. Please create the transfer manually.');
            },
          }
        );
      },
      onError: (error) => {
        console.error('Failed to delete transaction:', error);
        alert('Failed to convert to transfer. Please try again.');
      },
    });
  };

  const outflow = transaction.amount < 0 ? Math.abs(transaction.amount) : 0;
  const inflow = transaction.amount > 0 && !transaction.isStartingBalance ? transaction.amount : 0;

  // Show starting balance in inflow column
  const displayInflow = transaction.isStartingBalance ? transaction.amount : inflow;

  // Category display
  let categoryDisplay = transaction.categoryName || '';
  if (isTransfer && transaction.transferAccountName) {
    categoryDisplay = `Transfer: ${transaction.transferAccountName}`;
  } else if (isStartingBalance) {
    categoryDisplay = '';
  } else if (!transaction.categoryId && !isTransfer) {
    categoryDisplay = '';
  }

  const isMissingCategory = !transaction.categoryId && !isTransfer && !isStartingBalance && transaction.amount < 0;

  return (
    <div
      ref={rowRef}
      onClick={handleRowClick}
      className={`grid grid-cols-[100px_1fr_1fr_1fr_120px_120px_40px_40px] gap-2 px-4 py-2 transition-colors cursor-pointer ${
        isSelected
          ? 'bg-blue-50 border-l-2 border-blue-500'
          : isMissingCategory
          ? 'bg-red-50 hover:bg-red-100'
          : 'hover:bg-gray-50'
      }`}
    >
      {/* Date */}
      <div className="text-sm text-gray-700">
        {editingField === 'date' ? (
          <DateInput
            value={transaction.date}
            onChange={(value) => {
              updateTransaction.mutate({ id: transaction.id, date: value });
              setEditingField(null);
            }}
            onCancel={() => setEditingField(null)}
            autoFocus
            className="text-sm"
          />
        ) : (
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (canEditDate) setEditingField('date');
            }}
            className={`block ${canEditDate ? 'cursor-pointer hover:bg-blue-50 px-1 -mx-1 rounded' : ''}`}
          >
            {new Date(transaction.date).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </span>
        )}
      </div>

      {/* Payee */}
      <div className={`text-sm ${editingField === 'payee' ? '' : 'truncate'}`}>
        {editingField === 'payee' ? (
          <PayeeSelect
            value={tempPayee}
            onChange={(name) => {
              setTempPayee(name);
            }}
            onCancel={() => setEditingField(null)}
            onBlur={() => {
              updateTransaction.mutate({ id: transaction.id, payee: tempPayee || undefined });
              setEditingField(null);
            }}
            autoFocus
            className="text-sm"
            placeholder="Payee"
          />
        ) : (
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (canEditPayee) {
                setTempPayee(transaction.payee || '');
                setEditingField('payee');
              }
            }}
            className={`truncate block ${canEditPayee ? 'cursor-pointer hover:bg-blue-50 px-1 -mx-1 rounded' : ''}`}
          >
            {transaction.payee || '-'}
          </span>
        )}
      </div>

      {/* Category */}
      <div className={`text-sm truncate ${
        isMissingCategory ? 'text-red-600 font-medium' : 'text-gray-600'
      }`}>
        {editingField === 'category' ? (
          <CategorySelect
            value={transaction.categoryId}
            onChange={handleCategoryChange}
            onCancel={() => setEditingField(null)}
            currentAccountId={currentAccountId}
            allowNull
            autoFocus
            className="text-sm"
          />
        ) : (
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (canEditCategory) setEditingField('category');
            }}
            className={`truncate block ${canEditCategory ? 'cursor-pointer hover:bg-blue-50 px-1 -mx-1 rounded' : ''}`}
          >
            {isMissingCategory ? 'No category' : categoryDisplay || '-'}
          </span>
        )}
      </div>

      {/* Memo */}
      <div className="text-sm">
        {editingField === 'memo' ? (
          <TextInput
            value={transaction.memo || ''}
            onChange={(value) => {
              updateTransaction.mutate({ id: transaction.id, memo: value || undefined });
              setEditingField(null);
            }}
            onCancel={() => setEditingField(null)}
            autoFocus
            className="text-sm"
          />
        ) : (
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (canEditMemo) setEditingField('memo');
            }}
            className={`truncate block ${canEditMemo ? 'cursor-pointer hover:bg-blue-50 px-1 -mx-1 rounded' : ''}`}
          >
            {transaction.memo || '-'}
          </span>
        )}
      </div>

      {/* Outflow */}
      <div className="text-sm text-right text-red-600">
        {editingField === 'outflow' ? (
          <CurrencyInput
            value={Math.abs(transaction.amount)}
            onChange={handleOutflowChange}
            onCancel={() => setEditingField(null)}
            autoFocus
            className="text-sm text-right text-red-600"
          />
        ) : outflow > 0 ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (canEditAmount) setEditingField('outflow');
            }}
            className={`block ${canEditAmount ? 'cursor-pointer hover:bg-blue-50 px-1 -mx-1 rounded' : ''}`}
          >
            {formatNOK(outflow)}
          </span>
        ) : (
          ''
        )}
      </div>

      {/* Inflow */}
      <div className="text-sm text-right text-green-600">
        {editingField === 'inflow' ? (
          <CurrencyInput
            value={displayInflow}
            onChange={handleInflowChange}
            onCancel={() => setEditingField(null)}
            autoFocus
            className="text-sm text-right text-green-600"
          />
        ) : displayInflow > 0 ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (canEditAmount) setEditingField('inflow');
            }}
            className={`block ${canEditAmount ? 'cursor-pointer hover:bg-blue-50 px-1 -mx-1 rounded' : ''}`}
          >
            {formatNOK(displayInflow)}
          </span>
        ) : (
          ''
        )}
      </div>

      {/* Cleared/Reconciled */}
      <div className="flex items-center justify-center">
        {isReconciled ? (
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center bg-blue-500 text-white"
            title="Reconciled"
          >
            <Lock className="w-3 h-3" />
          </div>
        ) : (
          <button
            onClick={handleClearedToggle}
            disabled={!canToggleCleared}
            className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
              isCleared
                ? 'bg-green-500 text-white'
                : 'border border-gray-300 text-gray-300 hover:border-gray-400'
            }`}
            title={isCleared ? 'Cleared' : 'Uncleared'}
          >
            {isCleared ? <Check className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* Delete button - only visible when selected */}
      <div className="flex items-center justify-center">
        {isSelected && (
          <button
            onClick={handleDelete}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete transaction"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default TransactionRow;
