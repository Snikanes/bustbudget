import { CategoryTarget } from '@/types';

interface TargetProgressIndicatorProps {
  target: CategoryTarget;
  available: number;
  currentMonth: string;
}

function TargetProgressIndicator({
  target,
  available,
  currentMonth,
}: TargetProgressIndicatorProps) {
  // Calculate remaining amount needed
  const remaining = Math.max(0, target.targetAmount - available);

  // Calculate progress percentage
  const progress = Math.min(100, Math.max(0, (available / target.targetAmount) * 100));

  // Determine if on track for by_date targets
  const isOnTrack = () => {
    if (target.targetType === 'by_date') {
      const currentDate = new Date(currentMonth + '-01');
      const targetDate = new Date(target.targetDate);

      // Calculate total months from start to target
      const monthsRemaining = Math.max(
        1,
        (targetDate.getFullYear() - currentDate.getFullYear()) * 12 +
          (targetDate.getMonth() - currentDate.getMonth()) +
          1
      );

      // Rough estimate: assume we started with 0 and should have saved proportionally
      const totalMonths = monthsRemaining + 6; // Rough estimate of total time
      const elapsedMonths = totalMonths - monthsRemaining;
      const expectedByNow = (target.targetAmount / totalMonths) * elapsedMonths;

      // On track if we've saved at least 90% of expected amount
      return available >= expectedByNow * 0.9;
    }
    return false;
  };

  // Determine progress bar color
  const getBarColor = () => {
    if (target.targetType === 'by_date') {
      // Green if on track, yellow otherwise
      return isOnTrack() ? 'bg-green-500' : 'bg-yellow-500';
    } else {
      // Recurring targets: green if fully funded (available >= target)
      return available >= target.targetAmount ? 'bg-green-500' : 'bg-yellow-500';
    }
  };

  return (
    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`h-full ${getBarColor()} transition-all duration-300`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export function TargetProgressText({
  target,
  available,
}: TargetProgressIndicatorProps) {
  const remaining = Math.max(0, target.targetAmount - available);

  const formatAmount = (amount: number) => {
    const amountInKr = amount / 100;
    return amountInKr.toLocaleString('nb-NO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getDayWithSuffix = (date: Date) => {
    const day = date.getDate();
    return `${day}th`;
  };

  if (remaining <= 0) {
    return null; // Target met, don't show text
  }

  const targetDate = new Date(target.targetDate);
  const dayText = getDayWithSuffix(targetDate);

  return (
    <span className="text-gray-600 text-sm">
      {formatAmount(remaining)} more needed by the {dayText}
    </span>
  );
}

export default TargetProgressIndicator;
