import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths, parse } from 'date-fns';
import { nb } from 'date-fns/locale';

interface MonthNavigatorProps {
  currentMonth: string; // YYYY-MM
  onMonthChange: (month: string) => void;
}

function MonthNavigator({ currentMonth, onMonthChange }: MonthNavigatorProps) {
  const date = parse(currentMonth, 'yyyy-MM', new Date());

  const handlePrev = () => {
    const prev = subMonths(date, 1);
    onMonthChange(format(prev, 'yyyy-MM'));
  };

  const handleNext = () => {
    const next = addMonths(date, 1);
    onMonthChange(format(next, 'yyyy-MM'));
  };

  const displayDate = format(date, 'MMMM yyyy', { locale: nb });

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePrev}
        className="p-1 rounded hover:bg-gray-200 transition-colors"
        title="Previous month"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <span className="text-lg font-semibold min-w-[160px] text-center capitalize">
        {displayDate}
      </span>
      <button
        onClick={handleNext}
        className="p-1 rounded hover:bg-gray-200 transition-colors"
        title="Next month"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

export default MonthNavigator;
