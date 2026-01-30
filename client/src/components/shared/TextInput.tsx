import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  selectAllOnFocus?: boolean;
  placeholder?: string;
  className?: string;
  validate?: (value: string) => boolean;
}

function TextInput({
  value,
  onChange,
  onBlur,
  onCancel,
  autoFocus = true,
  selectAllOnFocus = true,
  placeholder = '',
  className = '',
  validate,
}: TextInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      if (selectAllOnFocus) {
        inputRef.current.select();
      }
    }
  }, [autoFocus, selectAllOnFocus]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (validate && !validate(trimmed)) {
        onCancel?.();
        return;
      }
      onChange(trimmed);
      onBlur?.();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel?.();
    }
  };

  const handleBlur = () => {
    const trimmed = inputValue.trim();
    if (validate && !validate(trimmed)) {
      onCancel?.();
      return;
    }
    onChange(trimmed);
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
      placeholder={placeholder}
      className={`w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-300 ${className}`}
    />
  );
}

export default TextInput;
