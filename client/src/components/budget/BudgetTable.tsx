import { useState } from 'react';
import { Plus } from 'lucide-react';
import { BudgetMonth } from '@/types';
import CategoryGroupRow from './CategoryGroupRow';
import CategoryRow from './CategoryRow';
import AddCategoryModal from './AddCategoryModal';

interface BudgetTableProps {
  budget: BudgetMonth;
  month: string;
}

function BudgetTable({ budget, month }: BudgetTableProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="grid grid-cols-[1fr_120px_120px_120px] gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50 text-sm font-medium text-gray-600">
        <div className="flex items-center gap-2">
          <span>Category</span>
          <button
            onClick={() => setShowModal(true)}
            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Add category"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="text-right">Assigned</div>
        <div className="text-right">Activity</div>
        <div className="text-right">Available</div>
      </div>

      {/* Groups */}
      {budget.groups.map((group) => (
        <CategoryGroupRow
          key={group.id}
          group={group}
          month={month}
        />
      ))}

      {/* Ungrouped categories */}
      {budget.ungroupedCategories.length > 0 && (
        <div className="border-t border-gray-200">
          {budget.ungroupedCategories.map((category) => (
            <CategoryRow
              key={category.categoryId}
              category={category}
              month={month}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {budget.groups.length === 0 && budget.ungroupedCategories.length === 0 && (
        <div className="px-4 py-8 text-center text-gray-500">
          <p>No categories yet.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            Create your first category
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && <AddCategoryModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

export default BudgetTable;
