import { useState } from 'react';
import { GripVertical } from 'lucide-react';
import { BudgetEntry } from '@/types';
import { formatNOK } from '@/utils/currency';
import { useUpdateBudgetEntry } from '@/hooks/queries/useBudget';
import { useUIStore } from '@/stores/uiStore';
import CurrencyInput from '@/components/shared/CurrencyInput';
import AvailabilityBadge from '@/components/shared/AvailabilityBadge';
import TargetProgressIndicator, { TargetProgressText } from './TargetProgressIndicator';

interface CategoryRowProps {
  category: BudgetEntry;
  month: string;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}

function CategoryRow({
  category,
  month,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragEnd,
}: CategoryRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const updateBudgetEntry = useUpdateBudgetEntry();
  const selectedCategory = useUIStore((s) => s.selectedCategory);
  const setSelectedCategory = useUIStore((s) => s.setSelectedCategory);

  const isSelected = selectedCategory?.id === category.categoryId;

  const handleRowClick = () => {
    setSelectedCategory({
      id: category.categoryId,
      name: category.categoryName,
      groupId: category.groupId,
    });
  };

  const handleAssignedChange = (value: number) => {
    updateBudgetEntry.mutate({
      month,
      categoryId: category.categoryId,
      assigned: value,
    });
    setIsEditing(false);
  };

  return (
    <div
      onClick={handleRowClick}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
      } ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'border-t-2 border-blue-500' : ''}`}
    >
      <div className="grid grid-cols-[1fr_120px_120px_120px] gap-2 px-4 py-2">
        {/* Category name with progress */}
        <div className="text-gray-700 flex flex-col gap-1 min-w-0">
          {/* Category name and target text on same line */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1 -ml-1"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-4 h-4" />
              </div>
              <span>{category.categoryName}</span>
            </div>
            {category.target && (
              <TargetProgressText
                target={category.target}
                assigned={category.assigned}
                activity={category.activity}
                available={category.available}
                currentMonth={month}
              />
            )}
          </div>
          {/* Progress bar */}
          {category.target && (
            <TargetProgressIndicator
              target={category.target}
              assigned={category.assigned}
              activity={category.activity}
              available={category.available}
              currentMonth={month}
            />
          )}
        </div>

        {/* Assigned */}
        <div className="text-right" onClick={(e) => e.stopPropagation()}>
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
    </div>
  );
}

export default CategoryRow;
