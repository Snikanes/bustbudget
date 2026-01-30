import MonthlySummary from '../budget/MonthlySummary';

function RightSidebar() {
  return (
    <aside className="w-72 bg-white border-l border-gray-200 p-4 overflow-auto">
      <MonthlySummary />
    </aside>
  );
}

export default RightSidebar;
