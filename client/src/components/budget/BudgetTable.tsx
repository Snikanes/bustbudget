import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { BudgetMonth, BudgetEntry } from '@/types';
import CategoryRow from './CategoryRow';
import AddCategoryModal from './AddCategoryModal';
import { useReorderCategories } from '@/hooks/queries/useCategories';

interface BudgetTableProps {
  budget: BudgetMonth;
  month: string;
}

function BudgetTable({ budget, month }: BudgetTableProps) {
  const [showModal, setShowModal] = useState(false);
  const [draggedCategory, setDraggedCategory] = useState<BudgetEntry | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const reorderCategories = useReorderCategories();

  // Flatten all categories from groups and ungrouped into a single list
  // Keep the backend order (sorted by sort_order)
  const allCategories = [
    ...budget.groups.flatMap((group) => group.categories),
    ...budget.ungroupedCategories,
  ].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleDragStart = useCallback((category: BudgetEntry) => {
    setDraggedCategory(category);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (draggedCategory && dragOverIndex !== null) {
      const currentIndex = allCategories.findIndex(
        (c) => c.categoryId === draggedCategory.categoryId
      );

      if (currentIndex !== dragOverIndex) {
        // Create new order array
        const newOrder = [...allCategories];
        const [removed] = newOrder.splice(currentIndex, 1);
        newOrder.splice(dragOverIndex, 0, removed);

        // For now, treat all categories as ungrouped for reordering
        // (since category groups are not displayed in the UI)
        const orderedIds = newOrder.map((c) => c.categoryId);

        reorderCategories.mutate({
          groupId: null,
          orderedIds,
        });
      }
    }
    setDraggedCategory(null);
    setDragOverIndex(null);
  }, [draggedCategory, dragOverIndex, allCategories, reorderCategories]);

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

      {/* Categories */}
      {allCategories.map((category, index) => (
        <CategoryRow
          key={category.categoryId}
          category={category}
          month={month}
          isDragging={draggedCategory?.categoryId === category.categoryId}
          isDragOver={dragOverIndex === index}
          onDragStart={() => handleDragStart(category)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
        />
      ))}

      {/* Empty state */}
      {allCategories.length === 0 && (
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
