import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useCategoryGroups } from '@/hooks/queries/useCategories';

interface CategorySelectProps {
  value: string | null;    // categoryId or null
  onChange: (value: string | null) => void;
  onBlur?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  allowNull?: boolean;     // Allow "Clear category" option
  className?: string;
}

function CategorySelect({
  value,
  onChange,
  onBlur,
  onCancel,
  autoFocus = true,
  allowNull = false,
  className = '',
}: CategorySelectProps) {
  const [inputValue, setInputValue] = useState(value || '');
  const selectRef = useRef<HTMLSelectElement>(null);
  const { data: categoryGroups } = useCategoryGroups();

  useEffect(() => {
    if (autoFocus && selectRef.current) {
      selectRef.current.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (e: KeyboardEvent<HTMLSelectElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const finalValue = inputValue === '__null__' ? null : inputValue || null;
      onChange(finalValue);
      onBlur?.();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel?.();
    }
  };

  const handleBlur = () => {
    const finalValue = inputValue === '__null__' ? null : inputValue || null;
    onChange(finalValue);
    onBlur?.();
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <select
      ref={selectRef}
      value={inputValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className={`w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-300 ${className}`}
    >
      <option value="">Select category...</option>
      {allowNull && <option value="__null__">Clear category</option>}

      {categoryGroups?.map((group) => (
        <optgroup key={group.id} label={group.name}>
          {group.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export default CategorySelect;
