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

  return targetAmount;
}
