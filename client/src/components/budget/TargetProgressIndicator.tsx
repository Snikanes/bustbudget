import { CategoryTarget } from '@/types';

interface TargetProgressIndicatorProps {
  target: CategoryTarget;
  available: number;
}

function TargetProgressIndicator({
  target,
  available,
}: TargetProgressIndicatorProps) {
  // Calculate remaining amount needed
  const remaining = Math.max(0, target.targetAmount - available);

  // Calculate progress percentage
  const progress = Math.min(100, Math.max(0, (available / target.targetAmount) * 100));

  // Format amount in Norwegian style (space as thousands separator, comma as decimal)
  const formatAmount = (amount: number) => {
    const amountInKr = amount / 100;
    return amountInKr.toLocaleString('nb-NO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Get the day with ordinal suffix
  const getDayWithSuffix = (date: Date) => {
    const day = date.getDate();
    return `${day}th`;
  };

  // Get target date display
  const getTargetDateText = () => {
    const targetDate = new Date(target.targetDate);
    return getDayWithSuffix(targetDate);
  };

  return (
    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-yellow-500 transition-all duration-300"
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
