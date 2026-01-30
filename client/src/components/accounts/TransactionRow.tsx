import { useState, useRef, useEffect } from 'react';
import { Check, Circle, Trash2 } from 'lucide-react';
import { Transaction } from '@/types';
import { formatNOK } from '@/utils/currency';
import { useUpdateTransaction, useDeleteTransaction } from '@/hooks/queries/useTransactions';

interface TransactionRowProps {
  transaction: Transaction;
}

function TransactionRow({ transaction }: TransactionRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [editedMemo, setEditedMemo] = useState(transaction.memo || '');
  const rowRef = useRef<HTMLDivElement>(null);
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  const isCleared = transaction.isCleared;
  const isTransfer = transaction.transferId !== null;
  const isStartingBalance = transaction.isStartingBalance;

  const canEditMemo = true; // Memo is always editable

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

  const handleMemoSave = () => {
    if (editedMemo !== transaction.memo) {
      updateTransaction.mutate({
        id: transaction.id,
        memo: editedMemo,
      });
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      deleteTransaction.mutate(transaction.id);
    }
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
        {new Date(transaction.date).toLocaleDateString('nb-NO')}
      </div>

      {/* Payee */}
      <div className="text-sm truncate">
        {transaction.payee || '-'}
      </div>

      {/* Category */}
      <div className={`text-sm truncate ${
        isMissingCategory ? 'text-red-600 font-medium' : 'text-gray-600'
      }`}>
        {isMissingCategory ? 'No category' : categoryDisplay || '-'}
      </div>

      {/* Memo */}
      <div className="text-sm">
        {isEditing ? (
          <input
            type="text"
            value={editedMemo}
            onChange={(e) => setEditedMemo(e.target.value)}
            onBlur={handleMemoSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleMemoSave();
              if (e.key === 'Escape') {
                setEditedMemo(transaction.memo || '');
                setIsEditing(false);
              }
            }}
            autoFocus
            className="w-full px-1 py-0.5 border border-blue-500 rounded text-sm"
          />
        ) : (
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (canEditMemo) setIsEditing(true);
            }}
            className={`truncate block ${canEditMemo ? 'cursor-pointer hover:bg-blue-50 px-1 -mx-1 rounded' : ''}`}
          >
            {transaction.memo || '-'}
          </span>
        )}
      </div>

      {/* Outflow */}
      <div className="text-sm text-right text-red-600">
        {outflow > 0 ? formatNOK(outflow) : ''}
      </div>

      {/* Inflow */}
      <div className="text-sm text-right text-green-600">
        {displayInflow > 0 ? formatNOK(displayInflow) : ''}
      </div>

      {/* Cleared */}
      <div className="flex items-center justify-center">
        <button
          onClick={handleClearedToggle}
          className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
            isCleared
              ? 'bg-green-500 text-white'
              : 'border border-gray-300 text-gray-300 hover:border-gray-400'
          }`}
          title={isCleared ? 'Cleared' : 'Uncleared'}
        >
          {isCleared ? <Check className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
        </button>
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
