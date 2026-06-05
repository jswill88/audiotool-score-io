import './SegmentedControl.css';

export function SegmentedControl({ value, options, onChange }) {
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
