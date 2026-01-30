import { useState } from 'react';
import { BudgetEntry } from '@/types';
import { formatNOK } from '@/utils/currency';
import { useUpdateBudgetEntry } from '@/hooks/queries/useBudget';
import CurrencyInput from '@/components/shared/CurrencyInput';
import AvailabilityBadge from '@/components/shared/AvailabilityBadge';

interface CategoryRowProps {
  category: BudgetEntry;
  month: string;
}

function CategoryRow({ category, month }: CategoryRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const updateBudgetEntry = useUpdateBudgetEntry();

  const handleAssignedChange = (value: number) => {
    updateBudgetEntry.mutate({
      month,
      categoryId: category.categoryId,
      assigned: value,
    });
    setIsEditing(false);
  };

  return (
    <div className="grid grid-cols-[1fr_120px_120px_120px] gap-2 px-4 py-2 hover:bg-gray-50 transition-colors">
      {/* Category name */}
      <div className="pl-6 text-gray-700">
        {category.categoryName}
      </div>

      {/* Assigned */}
      <div className="text-right">
        {isEditing ? (
          <CurrencyInput
            value={category.assigned}
            onChange={handleAssignedChange}
            onBlur={() => setIsEditing(false)}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="text-right w-full px-2 py-1 rounded hover:bg-blue-50 transition-colors"
          >
            {formatNOK(category.assigned)}
          </button>
        )}
      </div>

      {/* Activity */}
      <div className={`text-right py-1 ${
        category.activity < 0 ? 'text-red-600' : category.activity > 0 ? 'text-green-600' : 'text-gray-500'
      }`}>
        {formatNOK(category.activity)}
      </div>

      {/* Available */}
      <div className="text-right">
        <AvailabilityBadge amount={category.available} />
      </div>
    </div>
  );
}

export default CategoryRow;
