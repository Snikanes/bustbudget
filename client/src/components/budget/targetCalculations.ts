import { CategoryTarget } from '@/types';

/**
 * Calculate if a by_date target is on track based on linear progression.
 *
 * @returns true if available >= expected progress based on months elapsed
 */
export function isOnTrackForTarget(params: {
  target: CategoryTarget;
  available: number;
  currentMonth: string;
}): boolean {
  const { target, available, currentMonth } = params;

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
}

/**
 * Calculate the monthly target amount needed for a by_date target.
 * This is the amount that should be assigned each month to reach the target by the target date.
 *
 * @returns The monthly amount needed (in cents)
 */
export function calculateMonthlyTargetForByDate(params: {
  targetAmount: number;
  targetDate: string;
  currentMonth: string;
  currentAssigned: number;
  currentAvailable: number;
}): number {
  const { targetAmount, targetDate, currentMonth, currentAssigned, currentAvailable } = params;

  const currentDate = new Date(currentMonth + '-01');
  const target = new Date(targetDate);

  // Calculate months remaining (including current month)
  const monthsRemaining = Math.max(
    1,
    (target.getFullYear() - currentDate.getFullYear()) * 12 +
      (target.getMonth() - currentDate.getMonth()) +
      1
  );

  // Calculate available before this month's assignment
  // If assigned is negative, treat it as 0
  const effectiveAssigned = Math.max(0, currentAssigned);
  const availableBeforeThisMonth = currentAvailable - effectiveAssigned;

  // Calculate how much is still needed
  const actualRemaining = Math.max(0, targetAmount - availableBeforeThisMonth);

  // Calculate monthly target amount (round up to ensure we don't underfund)
  const monthlyTarget = Math.ceil(actualRemaining / monthsRemaining);

  return monthlyTarget;
}

/**
 * Calculate how much should be assigned to a category based on its target.
 * This is the pure calculation logic used by the "Assign Target Amount" button.
 */
export function calculateTargetAssignment(params: {
  targetType: 'monthly' | 'yearly' | 'by_date';
  targetAmount: number;
  targetDate?: string;
  currentMonth: string;
  currentAssigned: number;
  currentAvailable: number;
}): number {
  const { targetType, targetAmount, targetDate, currentMonth, currentAssigned, currentAvailable } = params;

  // For monthly and yearly targets, just return the full target amount
  if (targetType === 'monthly' || targetType === 'yearly') {
    return targetAmount;
  }

  // For by_date targets, calculate the monthly amount needed
  if (targetType === 'by_date' && targetDate) {
    return calculateMonthlyTargetForByDate({
      targetAmount,
      targetDate,
      currentMonth,
      currentAssigned,
      currentAvailable,
    });
  }

  return targetAmount;
}
