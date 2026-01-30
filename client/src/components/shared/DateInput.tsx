import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface DateInputProps {
  value: string;           // ISO date (YYYY-MM-DD)
  onChange: (value: string) => void;
  onBlur?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  className?: string;
}

function DateInput({
  value,
  onChange,
  onBlur,
  onCancel,
  autoFocus = true,
  className = '',
}: DateInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get today's date in YYYY-MM-DD format for max attribute
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onChange(inputValue);
      onBlur?.();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel?.();
    }
  };

  const handleBlur = () => {
    onChange(inputValue);
    onBlur?.();
  };

  return (
    <input
      ref={inputRef}
      type="date"
      value={inputValue}
      max={today}
      onChange={(e) => setInputValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className={`w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-300 ${className}`}
    />
  );
}

export default DateInput;
