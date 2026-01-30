import { formatNOK } from '@/utils/currency';

type AvailabilityStatus = 'funded' | 'partial' | 'overspent';

interface AvailabilityBadgeProps {
  amount: number;
  className?: string;
}

function getStatus(amount: number): AvailabilityStatus {
  if (amount > 0) return 'funded';
  if (amount === 0) return 'partial';
  return 'overspent';
}

const statusStyles: Record<AvailabilityStatus, string> = {
  funded: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  overspent: 'bg-red-100 text-red-800',
};

function AvailabilityBadge({ amount, className = '' }: AvailabilityBadgeProps) {
  const status = getStatus(amount);

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-sm font-medium ${statusStyles[status]} ${className}`}
    >
      {amount < 0 && '-'}
      {formatNOK(Math.abs(amount))}
    </span>
  );
}

export default AvailabilityBadge;
