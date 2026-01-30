import { useUIStore } from '@/stores/uiStore';
import MonthlySummary from '../budget/MonthlySummary';
import CategoryInspector from '../budget/CategoryInspector';

function RightSidebar() {
  const selectedCategory = useUIStore((s) => s.selectedCategory);

  return (
    <aside className="w-72 bg-white border-l border-gray-200 p-4 overflow-auto">
      {selectedCategory ? <CategoryInspector /> : <MonthlySummary />}
    </aside>
  );
}

export default RightSidebar;
