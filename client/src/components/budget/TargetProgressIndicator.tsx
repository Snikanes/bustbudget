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
  // Don't consider it overspent if assigned is negative (money moved out of category)
  const isOverspent = assigned >= 0 && spentAmount > assigned;
  const isUnderfunded = assigned < target.targetAmount;

  // Calculate progress percentage based on assigned amount
  // For negative assigned, show 0% progress
  const assignedProgress = Math.min(100, Math.max(0, (assigned / target.targetAmount) * 100));

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

  // Special case: Underfunded AND overspent
  // Show two-part bar: yellow for assigned, red striped for overspent
  if (isUnderfunded && isOverspent) {
    const overspentAmount = spentAmount - assigned;
    const overspentProgress = Math.min(
      100 - assignedProgress, // Cap so total doesn't exceed 100%
      (overspentAmount / target.targetAmount) * 100
    );

    return (
      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden flex">
        {/* Assigned portion (yellow) */}
        <div
          className="h-full bg-yellow-500 transition-all duration-300"
          style={{ width: `${assignedProgress}%` }}
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
        style={{ width: `${assignedProgress}%` }}
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
  const isOverspent = assigned >= 0 && spentAmount > assigned;
  // For negative assigned, remaining increases (target - negative = target + positive)
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
    // Calculate months remaining from current month to target month
    const currentDate = new Date(currentMonth + '-01');
    const targetDate = new Date(target.targetDate);

    const monthsRemaining = Math.max(
      1,
      (targetDate.getFullYear() - currentDate.getFullYear()) * 12 +
        (targetDate.getMonth() - currentDate.getMonth()) +
        1
    );

    // Calculate monthly amount needed (remaining / months remaining)
    // Available includes this month's assignment, so subtract it to get starting point
    // If assigned is negative, treat it as 0 (negative means money moved out)
    const effectiveAssigned = Math.max(0, assigned);
    const availableBeforeThisMonth = available - effectiveAssigned;
    const actualRemaining = target.targetAmount - availableBeforeThisMonth;
    const monthlyTarget = Math.ceil(actualRemaining / monthsRemaining);

    // Calculate how much more is needed this month after what's been assigned
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
