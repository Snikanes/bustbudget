import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useCategoryGroups } from '@/hooks/queries/useCategories';
import { useAccounts } from '@/hooks/queries/useAccounts';

interface CategorySelectProps {
  value: string | null;    // categoryId or null
  onChange: (value: string | null) => void;
  onBlur?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  allowNull?: boolean;     // Allow "Clear category" option
  className?: string;
  currentAccountId?: string;  // For filtering transfer accounts
}

function CategorySelect({
  value,
  onChange,
  onBlur,
  onCancel,
  autoFocus = true,
  allowNull = false,
  className = '',
  currentAccountId,
}: CategorySelectProps) {
  const [inputValue, setInputValue] = useState(value || '');
  const selectRef = useRef<HTMLSelectElement>(null);
  const { data: categoryGroups } = useCategoryGroups();
  const { data: accounts } = useAccounts();

  // Filter accounts for transfer options
  const transferAccounts = accounts
    ?.filter(account =>
      !account.isClosed &&
      account.id !== currentAccountId
    )
    .sort((a, b) => a.name.localeCompare(b.name)) || [];

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

      {transferAccounts.length > 0 && (
        <optgroup label="Transfers">
          {transferAccounts.map((account) => (
            <option key={account.id} value={`transfer:${account.id}`}>
              Transfer: {account.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

export default CategorySelect;
