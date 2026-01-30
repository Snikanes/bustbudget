import { ChevronDown, ChevronRight } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { BudgetEntry } from '@/types';
import { formatNOK } from '@/utils/currency';
import CategoryRow from './CategoryRow';

interface CategoryGroupRowProps {
  group: {
    id: string;
    name: string;
    categories: BudgetEntry[];
  };
  month: string;
}

function CategoryGroupRow({ group, month }: CategoryGroupRowProps) {
  const expandedGroups = useUIStore((s) => s.expandedGroups);
  const toggleGroupExpanded = useUIStore((s) => s.toggleGroupExpanded);

  const isExpanded = expandedGroups.has(group.id);

  // Calculate totals
  const totalAssigned = group.categories.reduce((sum, c) => sum + c.assigned, 0);
  const totalActivity = group.categories.reduce((sum, c) => sum + c.activity, 0);
  const totalAvailable = group.categories.reduce((sum, c) => sum + c.available, 0);

  return (
    <div className="border-b border-gray-100">
      {/* Group header */}
      <div
        className="grid grid-cols-[1fr_120px_120px_120px] gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
        onClick={() => toggleGroupExpanded(group.id)}
      >
        <div className="flex items-center gap-2 font-medium text-gray-700">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          {group.name}
        </div>
        <div className="text-right text-sm text-gray-600">
          {formatNOK(totalAssigned)}
        </div>
        <div className="text-right text-sm text-gray-600">
          {formatNOK(totalActivity)}
        </div>
        <div className={`text-right text-sm font-medium ${
          totalAvailable < 0 ? 'text-red-600' : totalAvailable > 0 ? 'text-green-600' : 'text-gray-600'
        }`}>
          {formatNOK(totalAvailable)}
        </div>
      </div>

      {/* Categories */}
      {isExpanded && (
        <div>
          {group.categories.map((category) => (
            <CategoryRow
              key={category.categoryId}
              category={category}
              month={month}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CategoryGroupRow;
