import { useId } from 'react';
import './SegmentedControl.css';

type SegmentedControlProps<T extends string> = {
  ariaLabel: string;
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({
  ariaLabel,
  value,
  options,
  onChange
}: SegmentedControlProps<T>) {
  const groupName = useId();

  return (
    <fieldset className="segmented-control">
      <legend>{ariaLabel}</legend>
      {options.map(([optionValue, label]) => {
        const checked = value === optionValue;
        const optionId = `${groupName}-${optionValue}`;

        return (
          <label
            className={checked ? 'is-active' : ''}
            htmlFor={optionId}
            key={optionValue}
          >
            <input
              checked={checked}
              id={optionId}
              name={groupName}
              type="radio"
              value={optionValue}
              onChange={() => onChange(optionValue)}
            />
            <span>{label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
