import { CategoryTarget } from '@/types';

interface TargetProgressIndicatorProps {
  target: CategoryTarget;
  assigned: number;
  activity: number;
  available: number;
  currentMonth: string;
}

function TargetProgressIndicator({
  target,
  assigned,
  activity,
  available,
  currentMonth,
}: TargetProgressIndicatorProps) {
  const spentAmount = Math.abs(activity);
  const isFunded = assigned >= target.targetAmount;
  const isOverspent = spentAmount > assigned;

  // Calculate progress percentage based on assigned amount
  const progress = Math.min(100, Math.max(0, (assigned / target.targetAmount) * 100));

  // Check if on track for by_date targets
  const isOnTrack = () => {
    if (target.targetType !== 'by_date') return false;

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
  };

  // Determine progress bar color
  const getBarColor = () => {
    if (isOverspent) {
      return 'bg-red-500';
    }
    if (isFunded) {
      return 'bg-green-500';
    }
    // For by_date targets, green if on track
    if (target.targetType === 'by_date' && isOnTrack()) {
      return 'bg-green-500';
    }
    return 'bg-yellow-500';
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
  assigned,
  activity,
  available,
  currentMonth,
}: TargetProgressIndicatorProps) {
  const spentAmount = Math.abs(activity);
  const isFunded = assigned >= target.targetAmount;
  const isOverspent = spentAmount > assigned;
  const remaining = Math.max(0, target.targetAmount - assigned);

  // Check if on track for by_date targets
  const isOnTrack = () => {
    if (target.targetType !== 'by_date') return false;

    const currentDate = new Date(currentMonth + '-01');
    const targetDate = new Date(target.targetDate);
    const createdDate = new Date(target.createdAt);

    const createdMonth = new Date(createdDate.getFullYear(), createdDate.getMonth(), 1);

    const totalMonths = Math.max(
      1,
      (targetDate.getFullYear() - createdMonth.getFullYear()) * 12 +
        (targetDate.getMonth() - createdMonth.getMonth()) +
        1
    );

    const monthsElapsed = Math.max(
      1,
      (currentDate.getFullYear() - createdMonth.getFullYear()) * 12 +
        (currentDate.getMonth() - createdMonth.getMonth()) +
        1
    );

    const expectedProgress = (target.targetAmount / totalMonths) * monthsElapsed;
    return available >= expectedProgress;
  };

  const formatAmount = (amount: number) => {
    const amountInKr = amount / 100;
    return amountInKr.toLocaleString('nb-NO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getDayWithSuffix = (date: Date) => {
    const day = date.getDate();
    return `${day}.`;
  };

  // Case 1: Overspent - spent more than assigned amount
  if (isOverspent) {
    return (
      <span className="text-red-600 text-sm">
        Overspent. {formatAmount(spentAmount)} of {formatAmount(assigned)}
      </span>
    );
  }

  // Case 2: Funded - assigned >= target
  if (isFunded) {
    if (available <= 0) {
      // Fully spent
      return (
        <span className="text-green-600 text-sm font-medium bg-green-100 px-2 py-0.5 rounded">
          Fully Spent
        </span>
      );
    } else {
      // Funded but not fully spent
      return (
        <span className="text-green-600 text-sm">
          Funded. Spent {formatAmount(spentAmount)} of {formatAmount(target.targetAmount)}
        </span>
      );
    }
  }

  // Case 3: By_date target that is on track
  if (target.targetType === 'by_date' && isOnTrack()) {
    return (
      <span className="text-green-600 text-sm font-medium">
        On track
      </span>
    );
  }

  // Case 4: Underfunded - assigned < target
  if (target.targetType === 'by_date') {
    const targetDate = new Date(target.targetDate);
    const dayText = getDayWithSuffix(targetDate);
    return (
      <span className="text-yellow-600 text-sm">
        {formatAmount(remaining)} more needed by the {dayText}
      </span>
    );
  }

  // Recurring targets (monthly/yearly)
  return (
    <span className="text-yellow-600 text-sm">
      {formatAmount(remaining)} more needed
    </span>
  );
}

export default TargetProgressIndicator;
