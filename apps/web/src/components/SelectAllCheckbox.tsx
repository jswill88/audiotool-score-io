import { useEffect, useId, useRef } from 'react';

type SelectAllCheckboxProps = {
  ariaLabel: string;
  checked: boolean;
  countText: string;
  disabled?: boolean;
  indeterminate: boolean;
  label: string;
  onToggle: () => void;
};

export function SelectAllCheckbox({
  ariaLabel,
  checked,
  countText,
  disabled = false,
  indeterminate,
  label,
  onToggle
}: SelectAllCheckboxProps) {
  const countId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <div className="master-checkbox-row">
      <label className="master-checkbox">
        <input
          ref={inputRef}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-describedby={countId}
          onChange={onToggle}
        />
        <span>{label}</span>
      </label>
      <span className="master-checkbox-count" id={countId}>
        {countText}
      </span>
    </div>
  );
}
