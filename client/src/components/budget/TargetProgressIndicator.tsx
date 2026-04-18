import { CategoryTarget } from '@/types';
import { isOnTrackForTarget, calculateMonthlyTargetForByDate } from './targetCalculations';

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
  // Don't consider it overspent if assigned is negative (money moved out of category)
  const isOverspent = assigned >= 0 && available < 0;
  const isUnderfunded = assigned < target.targetAmount;

  // Calculate progress percentage
  // For by_date targets: use available (total cumulative progress)
  // For recurring targets: use assigned (this month's progress)
  const progress = target.targetType === 'by_date'
    ? Math.min(100, Math.max(0, (available / target.targetAmount) * 100))
    : Math.min(100, Math.max(0, (assigned / target.targetAmount) * 100));

  // Check if on track for by_date targets
  const isOnTrack = () => isOnTrackForTarget({ target, available, currentMonth });

  // Special case: Underfunded AND overspent
  // Show two-part bar: yellow for assigned, red striped for overspent
  if (isUnderfunded && isOverspent) {
    const overspentAmount = -available;
    const overspentProgress = Math.min(
      100 - progress, // Cap so total doesn't exceed 100%
      (overspentAmount / target.targetAmount) * 100
    );

    return (
      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden flex">
        {/* Assigned portion (yellow) */}
        <div
          className="h-full bg-yellow-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
        {/* Overspent portion (red with stripes) */}
        <div
          className="h-full bg-red-500 bg-stripe-red transition-all duration-300"
          style={{ width: `${overspentProgress}%` }}
        />
      </div>
    );
  }

  // Standard single-bar display for all other cases
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
  // Don't consider it overspent if assigned is negative (money moved out of category)
  const isOverspent = assigned >= 0 && available < 0;
  // For negative assigned, remaining increases (target - negative = target + positive)
  const remaining = Math.max(0, target.targetAmount - assigned);

  // Check if on track for by_date targets
  const isOnTrack = () => isOnTrackForTarget({ target, available, currentMonth });

  const formatAmount = (amount: number) => {
    const amountInKr = amount / 100;
    return amountInKr.toLocaleString('nb-NO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
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
    } else if (spentAmount === 0) {
      // Funded but nothing spent yet
      return (
        <span className="text-green-600 text-sm font-medium bg-green-100 px-2 py-0.5 rounded">
          Funded
        </span>
      );
    } else {
      // Funded and partially spent
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
    // Use shared calculation for monthly target
    const monthlyTarget = calculateMonthlyTargetForByDate({
      targetAmount: target.targetAmount,
      targetDate: target.targetDate,
      currentMonth,
      currentAssigned: assigned,
      currentAvailable: available,
    });

    // Calculate how much more is needed this month after what's been assigned
    const effectiveAssigned = Math.max(0, assigned);
    const moreNeededThisMonth = Math.max(0, monthlyTarget - effectiveAssigned);

    // If already assigned enough this month, show as on track
    if (moreNeededThisMonth === 0) {
      return (
        <span className="text-green-600 text-sm font-medium">
          On track
        </span>
      );
    }

    // Show different text based on whether anything has been assigned yet
    if (effectiveAssigned > 0) {
      return (
        <span className="text-yellow-600 text-sm">
          {formatAmount(moreNeededThisMonth)} more needed this month
        </span>
      );
    } else {
      return (
        <span className="text-yellow-600 text-sm">
          {formatAmount(moreNeededThisMonth)} needed this month
        </span>
      );
    }
  }

  // Recurring targets (monthly/yearly)
  return (
    <span className="text-yellow-600 text-sm">
      {formatAmount(remaining)} more needed
    </span>
  );
}

export default TargetProgressIndicator;
