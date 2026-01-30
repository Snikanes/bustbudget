import { useUIStore } from '@/stores/uiStore';
import { useBudget } from '@/hooks/queries/useBudget';
import { formatNOK } from '@/utils/currency';
import MonthNavigator from './MonthNavigator';
import BudgetTable from './BudgetTable';

function BudgetView() {
  const selectedMonth = useUIStore((s) => s.selectedMonth);
  const setSelectedMonth = useUIStore((s) => s.setSelectedMonth);

  const { data: budget, isLoading, error } = useBudget(selectedMonth);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-gray-200 rounded mb-4" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600">Error loading budget: {error.message}</div>
      </div>
    );
  }

  const isOverAssigned = budget ? budget.availableToAssign < 0 : false;

  return (
    <div className="h-full flex flex-col">
      <header className="border-b border-gray-200 bg-white">
        {/* Available to Assign */}
        {budget && (
          <div className={`px-6 py-3 ${
            isOverAssigned ? 'bg-red-50' : 'bg-green-50'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">
                Available to Assign
              </span>
              <span className={`text-xl font-bold ${
                isOverAssigned ? 'text-red-600' : 'text-green-600'
              }`}>
                {budget.availableToAssign < 0 && '-'}
                {formatNOK(Math.abs(budget.availableToAssign))}
              </span>
            </div>
          </div>
        )}

        {/* Month Navigator */}
        <div className="px-6 py-4">
          <MonthNavigator
            currentMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
          />
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {budget && <BudgetTable budget={budget} month={selectedMonth} />}
      </div>
    </div>
  );
}

export default BudgetView;
