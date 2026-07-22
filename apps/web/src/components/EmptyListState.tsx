import './EmptyListState.css';

type EmptyListStateProps = {
  description: string;
  title: string;
};

export function EmptyListState({
  description,
  title
}: EmptyListStateProps) {
  return (
    <div className="empty-list-state">
      <div className="empty-list-state-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
    </div>
  );
}
