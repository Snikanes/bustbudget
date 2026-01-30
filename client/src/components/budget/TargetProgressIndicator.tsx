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
      const createdDate = new Date(target.createdAt);

      // Use the first of the month for the created date
      const createdMonth = new Date(createdDate.getFullYear(), createdDate.getMonth(), 1);

      // Calculate total months from creation to target
      const totalMonths = Math.max(
        1,
        (targetDate.getFullYear() - createdMonth.getFullYear()) * 12 +
          (targetDate.getMonth() - createdMonth.getMonth()) +
          1
      );

      // Calculate months elapsed since creation
      const monthsElapsed = Math.max(
        1,
        (currentDate.getFullYear() - createdMonth.getFullYear()) * 12 +
          (currentDate.getMonth() - createdMonth.getMonth()) +
          1
      );

      // Calculate expected progress by now (linear progression)
      const expectedProgress = (target.targetAmount / totalMonths) * monthsElapsed;

      // On track if available >= expected progress
      return available >= expectedProgress;
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
  currentMonth,
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

  // Check if on track for by_date targets
  const isOnTrack = () => {
    if (target.targetType === 'by_date') {
      const currentDate = new Date(currentMonth + '-01');
      const targetDate = new Date(target.targetDate);
      const createdDate = new Date(target.createdAt);

      // Use the first of the month for the created date
      const createdMonth = new Date(createdDate.getFullYear(), createdDate.getMonth(), 1);

      // Calculate total months from creation to target
      const totalMonths = Math.max(
        1,
        (targetDate.getFullYear() - createdMonth.getFullYear()) * 12 +
          (targetDate.getMonth() - createdMonth.getMonth()) +
          1
      );

      // Calculate months elapsed since creation
      const monthsElapsed = Math.max(
        1,
        (currentDate.getFullYear() - createdMonth.getFullYear()) * 12 +
          (currentDate.getMonth() - createdMonth.getMonth()) +
          1
      );

      // Calculate expected progress by now (linear progression)
      const expectedProgress = (target.targetAmount / totalMonths) * monthsElapsed;

      // On track if available >= expected progress
      return available >= expectedProgress;
    }
    return false;
  };

  if (remaining <= 0) {
    return null; // Target met, don't show text
  }

  // Show "On track" for by_date targets that are on track
  if (target.targetType === 'by_date' && isOnTrack()) {
    return (
      <span className="text-green-600 text-sm font-medium">
        On track
      </span>
    );
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
