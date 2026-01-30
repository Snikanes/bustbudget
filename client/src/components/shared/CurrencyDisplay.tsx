import { formatNOK } from '@/utils/currency';

interface CurrencyDisplayProps {
  value: number;
  showSign?: boolean;
  colorCode?: boolean;
  className?: string;
}

function CurrencyDisplay({ value, showSign, colorCode, className = '' }: CurrencyDisplayProps) {
  const formatted = formatNOK(Math.abs(value));
  let prefix = '';

  if (showSign && value !== 0) {
    prefix = value > 0 ? '+' : '-';
  } else if (value < 0) {
    prefix = '-';
  }

  let colorClass = '';
  if (colorCode) {
    if (value > 0) colorClass = 'text-green-600';
    else if (value < 0) colorClass = 'text-red-600';
    else colorClass = 'text-gray-500';
  }

  return (
    <span className={`${colorClass} ${className}`}>
      {prefix}{formatted}
    </span>
  );
}

export default CurrencyDisplay;
