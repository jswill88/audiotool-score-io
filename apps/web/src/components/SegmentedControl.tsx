import { useId, type CSSProperties } from 'react';
import './SegmentedControl.css';

type SegmentedControlProps<T extends string> = {
  ariaLabel: string;
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (value: T) => void;
  variant?: 'radio' | 'buttons';
};

export function SegmentedControl<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
  variant = 'radio'
}: SegmentedControlProps<T>) {
  const groupName = useId();

  if (variant === 'buttons') {
    return (
      <div
        aria-label={ariaLabel}
        className="segmented-control"
        role="group"
        style={{ '--segment-count': options.length } as CSSProperties}
      >
        {options.map(([optionValue, label]) => {
          const checked = value === optionValue;

          return (
            <button
              aria-pressed={checked}
              className={checked ? 'is-active' : ''}
              key={optionValue}
              type="button"
              onClick={() => onChange(optionValue)}
            >
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <fieldset
      className="segmented-control"
      style={{ '--segment-count': options.length } as CSSProperties}
    >
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
