import { useUIStore } from '@/stores/uiStore';
import { useBudget } from '@/hooks/queries/useBudget';
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

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-gray-200 bg-white">
        <MonthNavigator
          currentMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
        />
      </header>

      <div className="flex-1 overflow-auto p-6">
        {budget && <BudgetTable budget={budget} month={selectedMonth} />}
      </div>
    </div>
  );
}

export default BudgetView;
