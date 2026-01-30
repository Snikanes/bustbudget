import { useState } from 'react';
import { X, Trash2, Edit2, FolderInput, DollarSign } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useUpdateCategory, useDeleteCategory, useCategoryGroups } from '@/hooks/queries/useCategories';
import { budgetKeys, useUpdateBudgetEntry, useBudget } from '@/hooks/queries/useBudget';
import { useQueryClient } from '@tanstack/react-query';
import CategoryTarget from './CategoryTarget';
import { useCategoryTarget } from '@/hooks/queries/useCategoryTargets';

function CategoryInspector() {
  const queryClient = useQueryClient();
  const selectedCategory = useUIStore((s) => s.selectedCategory);
  const setSelectedCategory = useUIStore((s) => s.setSelectedCategory);
  const selectedMonth = useUIStore((s) => s.selectedMonth);

  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [isMoving, setIsMoving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: categoryGroups } = useCategoryGroups();
  const { data: budgetData } = useBudget(selectedMonth);
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const updateBudgetEntry = useUpdateBudgetEntry();
  const { data: categoryTarget } = useCategoryTarget(selectedCategory?.id || '');

  if (!selectedCategory) return null;

  const handleClose = () => {
    setSelectedCategory(null);
    setIsRenaming(false);
    setIsMoving(false);
    setShowDeleteConfirm(false);
  };

  const handleStartRename = () => {
    setNewName(selectedCategory.name);
    setIsRenaming(true);
    setIsMoving(false);
    setShowDeleteConfirm(false);
  };

  const handleRename = () => {
    if (newName.trim() && newName !== selectedCategory.name) {
      updateCategory.mutate(
        { id: selectedCategory.id, name: newName.trim() },
        {
          onSuccess: () => {
            setSelectedCategory({
              ...selectedCategory,
              name: newName.trim(),
            });
            setIsRenaming(false);
            queryClient.invalidateQueries({ queryKey: budgetKeys.month(selectedMonth) });
          },
        }
      );
    } else {
      setIsRenaming(false);
    }
  };

  const handleStartMove = () => {
    setIsMoving(true);
    setIsRenaming(false);
    setShowDeleteConfirm(false);
  };

  const handleMove = (groupId: string | null) => {
    updateCategory.mutate(
      { id: selectedCategory.id, groupId },
      {
        onSuccess: () => {
          setSelectedCategory({
            ...selectedCategory,
            groupId,
          });
          setIsMoving(false);
          queryClient.invalidateQueries({ queryKey: budgetKeys.month(selectedMonth) });
        },
      }
    );
  };

  const handleDelete = () => {
    deleteCategory.mutate(selectedCategory.id, {
      onSuccess: () => {
        setSelectedCategory(null);
        queryClient.invalidateQueries({ queryKey: budgetKeys.month(selectedMonth) });
      },
    });
  };

  const handleAssignTarget = () => {
    if (categoryTarget && budgetData) {
      let assignedAmount = categoryTarget.targetAmount;

      // For by_date targets, calculate monthly amount based on months remaining
      if (categoryTarget.targetType === 'by_date') {
        const currentDate = new Date(selectedMonth + '-01');
        const targetDate = new Date(categoryTarget.targetDate);

        // Calculate months remaining (including current month)
        const monthsRemaining =
          (targetDate.getFullYear() - currentDate.getFullYear()) * 12 +
          (targetDate.getMonth() - currentDate.getMonth()) + 1;

        if (monthsRemaining > 0) {
          // Find current category's available amount
          let currentAvailable = 0;
          for (const group of budgetData.groups) {
            const category = group.categories.find(c => c.categoryId === selectedCategory.id);
            if (category) {
              currentAvailable = category.available;
              break;
            }
          }
          if (currentAvailable === 0) {
            const ungroupedCategory = budgetData.ungroupedCategories.find(
              c => c.categoryId === selectedCategory.id
            );
            if (ungroupedCategory) {
              currentAvailable = ungroupedCategory.available;
            }
          }

          // Calculate remaining amount needed
          const remainingNeeded = Math.max(0, categoryTarget.targetAmount - currentAvailable);
          assignedAmount = Math.round(remainingNeeded / monthsRemaining);
        }
      }

      updateBudgetEntry.mutate({
        month: selectedMonth,
        categoryId: selectedCategory.id,
        assigned: assignedAmount,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 truncate pr-2">
          {selectedCategory.name}
        </h3>
        <button
          onClick={handleClose}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {/* Rename */}
        {isRenaming ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setIsRenaming(false);
              }}
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleRename}
                disabled={updateCategory.isPending}
                className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setIsRenaming(false)}
                className="flex-1 px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleStartRename}
            className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            <span>Rename Category</span>
          </button>
        )}

        {/* Move */}
        {isMoving ? (
          <div className="space-y-2">
            <div className="text-sm text-gray-600 mb-1">Move to group:</div>
            <div className="max-h-48 overflow-auto border border-gray-200 rounded">
              <button
                onClick={() => handleMove(null)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                  selectedCategory.groupId === null ? 'bg-blue-50 text-blue-700' : ''
                }`}
              >
                (No group)
              </button>
              {categoryGroups?.map((group) => (
                <button
                  key={group.id}
                  onClick={() => handleMove(group.id)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 border-t border-gray-100 ${
                    selectedCategory.groupId === group.id ? 'bg-blue-50 text-blue-700' : ''
                  }`}
                >
                  {group.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setIsMoving(false)}
              className="w-full px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartMove}
            className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            <FolderInput className="w-4 h-4" />
            <span>Move to Group</span>
          </button>
        )}

        {/* Delete */}
        {showDeleteConfirm ? (
          <div className="space-y-2 p-3 bg-red-50 rounded border border-red-200">
            <p className="text-sm text-red-800">
              Delete "{selectedCategory.name}"? This will remove all budget assignments for this category.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleteCategory.isPending}
                className="flex-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setShowDeleteConfirm(true);
              setIsRenaming(false);
              setIsMoving(false);
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-left text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Category</span>
          </button>
        )}
      </div>

      {/* Target Section */}
      <CategoryTarget categoryId={selectedCategory.id} />

      {/* Quick Assign Target Button */}
      {categoryTarget && (
        <div className="pt-2">
          <button
            onClick={handleAssignTarget}
            disabled={updateBudgetEntry.isPending}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            <span>Assign Target Amount</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default CategoryInspector;
