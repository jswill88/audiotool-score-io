import './SegmentedControl.css';

type SegmentedControlProps<T extends string> = {
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange
}: SegmentedControlProps<T>) {
  return (
    <div className="segmented-control">
      {options.map(([optionValue, label]) => (
        <button
          className={value === optionValue ? 'is-active' : ''}
          key={optionValue}
          type="button"
          onClick={() => onChange(optionValue)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
