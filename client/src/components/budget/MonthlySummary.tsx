import { useUIStore } from '@/stores/uiStore';
import { useBudget } from '@/hooks/queries/useBudget';
import { formatNOK } from '@/utils/currency';

function MonthlySummary() {
  const selectedMonth = useUIStore((s) => s.selectedMonth);
  const { data: budget, isLoading } = useBudget(selectedMonth);

  if (isLoading || !budget) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-6 w-32 bg-gray-200 rounded mb-2" />
          <div className="h-10 w-full bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="space-y-3">
        <div className="text-sm font-medium text-gray-600 mb-2">
          Month Summary
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total Inflows</span>
          <span className="font-medium">{formatNOK(budget.totalInflows)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total Assigned</span>
          <span className="font-medium">{formatNOK(budget.totalAssigned)}</span>
        </div>
      </div>

      {/* Category Stats */}
      <div className="border-t pt-4">
        <div className="text-sm font-medium text-gray-600 mb-2">
          Categories
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Groups</span>
            <span>{budget.groups.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Categories</span>
            <span>
              {budget.groups.reduce((sum, g) => sum + g.categories.length, 0) +
                budget.ungroupedCategories.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MonthlySummary;
