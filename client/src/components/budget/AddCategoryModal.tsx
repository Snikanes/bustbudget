import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { useCreateCategory } from '@/hooks/queries/useCategories';
import { budgetKeys } from '@/hooks/queries/useBudget';
import { useQueryClient } from '@tanstack/react-query';

interface AddCategoryModalProps {
  onClose: () => void;
}

function AddCategoryModal({ onClose }: AddCategoryModalProps) {
  const [name, setName] = useState('');

  const createCategory = useCreateCategory();
  const queryClient = useQueryClient();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    createCategory.mutate(
      {
        name,
      },
      {
        onSuccess: () => {
          // Invalidate budget queries to refresh the view
          queryClient.invalidateQueries({ queryKey: budgetKeys.all });
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Category</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Groceries"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
              autoFocus
              required
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createCategory.isPending || !name.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {createCategory.isPending ? 'Creating...' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddCategoryModal;
