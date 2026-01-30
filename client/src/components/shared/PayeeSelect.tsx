import { useState, useRef, useEffect, KeyboardEvent, useMemo } from 'react';
import { usePayees } from '@/hooks/queries/usePayees';

interface PayeeSelectProps {
  value: string;
  onChange: (name: string, lastCategoryId: string | null) => void;
  onBlur?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

function PayeeSelect({
  value,
  onChange,
  onBlur,
  onCancel,
  autoFocus = false,
  disabled = false,
  className = '',
  placeholder = 'Who did you pay?',
}: PayeeSelectProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: payees = [] } = usePayees();

  // Filter payees based on input
  const filteredPayees = useMemo(() => {
    if (!inputValue.trim()) {
      return payees;
    }
    const search = inputValue.toLowerCase();
    return payees.filter((p) => p.name.toLowerCase().includes(search));
  }, [payees, inputValue]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectPayee = (name: string, lastCategoryId: string | null) => {
    setInputValue(name);
    onChange(name, lastCategoryId);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);
    // Emit change with no category since user is typing a potentially new payee
    onChange(newValue, null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex((prev) =>
          prev < filteredPayees.length - 1 ? prev + 1 : prev
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && filteredPayees[highlightedIndex]) {
        const payee = filteredPayees[highlightedIndex];
        selectPayee(payee.name, payee.lastCategoryId);
      } else {
        // Use current input value as-is (new payee)
        setIsOpen(false);
        onBlur?.();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (isOpen) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      } else {
        onCancel?.();
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleBlur = () => {
    // Small delay to allow click on dropdown item
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setIsOpen(false);
        onBlur?.();
      }
    }, 150);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          disabled ? 'bg-gray-100 cursor-not-allowed' : ''
        } ${className}`}
      />

      {isOpen && filteredPayees.length > 0 && !disabled && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-auto"
        >
          {filteredPayees.map((payee, index) => (
            <li
              key={payee.id}
              onMouseDown={(e) => {
                e.preventDefault();
                selectPayee(payee.name, payee.lastCategoryId);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`px-3 py-2 cursor-pointer ${
                index === highlightedIndex
                  ? 'bg-blue-100'
                  : 'hover:bg-gray-100'
              }`}
            >
              {payee.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default PayeeSelect;
