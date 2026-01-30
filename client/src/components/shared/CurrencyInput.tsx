import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { parseNOK } from '@/utils/currency';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  className?: string;
}

function CurrencyInput({
  value,
  onChange,
  onBlur,
  onCancel,
  autoFocus = true,
  className = '',
}: CurrencyInputProps) {
  const [inputValue, setInputValue] = useState(() => {
    const kroner = value / 100;
    return kroner.toFixed(2).replace('.', ',');
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const parsedValue = parseNOK(inputValue);
      onChange(parsedValue);
      onBlur?.();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel?.();
    }
  };

  const handleBlur = () => {
    const parsedValue = parseNOK(inputValue);
    onChange(parsedValue);
    onBlur?.();
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className={`w-full px-2 py-1 text-right border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-300 ${className}`}
    />
  );
}

export default CurrencyInput;
