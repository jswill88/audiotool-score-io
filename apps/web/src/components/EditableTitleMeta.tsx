import { InlineTextEdit } from './InlineTextEdit';
import './EditableTitleMeta.css';

type EditableTitleMetaProps = {
  ariaLabel: string;
  fallbackValue: string;
  onCommit: (title: string) => void;
  summary: string;
  value: string;
};

export function EditableTitleMeta({
  ariaLabel,
  fallbackValue,
  onCommit,
  summary,
  value
}: EditableTitleMetaProps) {
  return (
    <div className="editable-title-meta">
      <strong>
        <InlineTextEdit
          ariaLabel={ariaLabel}
          fallbackValue={fallbackValue}
          value={value}
          onCommit={onCommit}
        />
      </strong>
      <span>{summary}</span>
    </div>
  );
}
