import { useState, useEffect } from 'react';
import { Target, Trash2 } from 'lucide-react';
import {
  useCategoryTarget,
  useCreateCategoryTarget,
  useUpdateCategoryTarget,
  useDeleteCategoryTarget,
} from '@/hooks/queries/useCategoryTargets';

interface CategoryTargetProps {
  categoryId: string;
}

type TargetType = 'monthly' | 'yearly' | 'by_date';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d,-]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100);
}

function getLastDayOfMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
}

function CategoryTarget({ categoryId }: CategoryTargetProps) {
  const { data: target, isLoading } = useCategoryTarget(categoryId);
  const createTarget = useCreateCategoryTarget();
  const updateTarget = useUpdateCategoryTarget();
  const deleteTarget = useDeleteCategoryTarget();

  const [isEditing, setIsEditing] = useState(false);
  const [targetType, setTargetType] = useState<TargetType>('monthly');
  const [amountInput, setAmountInput] = useState('');
  const [targetDate, setTargetDate] = useState('');

  useEffect(() => {
    if (target) {
      setTargetType(target.targetType);
      setAmountInput((target.targetAmount / 100).toFixed(2).replace('.', ','));
      setTargetDate(target.targetDate);
    }
  }, [target]);

  const handleSetTarget = () => {
    const currentYearMonth = new Date().toISOString().slice(0, 7);
    setTargetType('monthly');
    setAmountInput('');
    setTargetDate(getLastDayOfMonth(currentYearMonth));
    setIsEditing(true);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (target) {
      setTargetType(target.targetType);
      setAmountInput((target.targetAmount / 100).toFixed(2).replace('.', ','));
      setTargetDate(target.targetDate);
    }
    setIsEditing(false);
  };

  const handleSave = () => {
    const amount = parseCurrency(amountInput);

    if (amount <= 0) {
      alert('Target amount must be greater than 0');
      return;
    }

    const data = {
      targetType,
      targetAmount: amount,
      targetDate,
      recurrenceDay: targetType === 'monthly' ? parseInt(targetDate.slice(-2)) : undefined,
    };

    if (target) {
      updateTarget.mutate(
        { categoryId, data },
        {
          onSuccess: () => {
            setIsEditing(false);
          },
        }
      );
    } else {
      createTarget.mutate(
        { categoryId, data },
        {
          onSuccess: () => {
            setIsEditing(false);
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (confirm('Delete this target?')) {
      deleteTarget.mutate(categoryId, {
        onSuccess: () => {
          setIsEditing(false);
        },
      });
    }
  };

  const handleTypeChange = (type: TargetType) => {
    setTargetType(type);
    const currentYearMonth = new Date().toISOString().slice(0, 7);
    if (type === 'monthly') {
      setTargetDate(getLastDayOfMonth(currentYearMonth));
    } else if (type === 'yearly') {
      const currentYear = new Date().getFullYear();
      setTargetDate(`${currentYear}-12-31`);
    } else if (type === 'by_date') {
      // Default to 6 months from now
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 6);
      setTargetDate(futureDate.toISOString().slice(0, 10));
    }
  };

  if (isLoading) {
    return (
      <div className="pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-500">Loading target...</div>
      </div>
    );
  }

  // Collapsed state - no target exists
  if (!target && !isEditing) {
    return (
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={handleSetTarget}
          className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-700 hover:bg-gray-100 rounded transition-colors"
        >
          <Target className="w-4 h-4" />
          <span>Set Target</span>
        </button>
      </div>
    );
  }

  // Display mode - target exists
  if (target && !isEditing) {
    return (
      <div className="pt-4 border-t border-gray-200 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Target</span>
          </div>
          <button
            onClick={handleEdit}
            className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
          >
            Edit
          </button>
        </div>
        <div className="pl-6 space-y-1">
          <div className="text-sm text-gray-900 font-medium">
            {formatCurrency(target.targetAmount)}
          </div>
          <div className="text-xs text-gray-500">
            {target.targetType === 'monthly'
              ? 'Monthly'
              : target.targetType === 'yearly'
              ? 'Yearly'
              : `By ${new Date(target.targetDate).toLocaleDateString('nb-NO', { year: 'numeric', month: 'short' })}`}
          </div>
        </div>
      </div>
    );
  }

  // Edit mode
  return (
    <div className="pt-4 border-t border-gray-200 space-y-3">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">Target</span>
      </div>

      {/* Target Type Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => handleTypeChange('monthly')}
          className={`px-3 py-1.5 text-sm rounded border transition-colors ${
            targetType === 'monthly'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => handleTypeChange('yearly')}
          className={`px-3 py-1.5 text-sm rounded border transition-colors ${
            targetType === 'yearly'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Yearly
        </button>
        <button
          onClick={() => handleTypeChange('by_date')}
          className={`px-3 py-1.5 text-sm rounded border transition-colors ${
            targetType === 'by_date'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          By Date
        </button>
      </div>

      {/* Amount Input */}
      <div className="space-y-1">
        <label className="text-xs text-gray-600">I need</label>
        <input
          type="text"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          placeholder="0,00"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Date Selector */}
      <div className="space-y-1">
        <label className="text-xs text-gray-600">By</label>
        {targetType === 'by_date' ? (
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <div className="text-sm text-gray-700 px-3 py-2 bg-gray-50 rounded border border-gray-200">
            {targetType === 'monthly' ? 'Last Day of Month' : 'December 31'}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {target && (
          <button
            onClick={handleDelete}
            disabled={deleteTarget.isPending}
            className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={handleCancel}
          className="px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={createTarget.isPending || updateTarget.isPending}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Save Target
        </button>
      </div>
    </div>
  );
}

export default CategoryTarget;
