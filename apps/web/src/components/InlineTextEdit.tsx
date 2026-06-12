import { useEffect, useRef, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import './InlineTextEdit.css';

type InlineTextEditProps = {
  ariaLabel: string;
  value: string;
  fallbackValue: string;
  onCommit: (value: string) => void;
  className?: string;
};

export function InlineTextEdit({
  ariaLabel,
  value,
  fallbackValue,
  onCommit,
  className = ''
}: InlineTextEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);
  const displayValue = value || fallbackValue;

  useEffect(() => {
    if (!isEditing) {
      setDraft(value);
    }
  }, [isEditing, value]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      triggerRef.current?.focus();
    }
  }, [isEditing]);

  function commitDraft() {
    onCommit(draft.trim() || fallbackValue);
    restoreFocusRef.current = true;
    setIsEditing(false);
  }

  function cancelDraft() {
    setDraft(value);
    restoreFocusRef.current = true;
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <span className={`inline-text-edit is-editing ${className}`.trim()}>
        <input
          ref={inputRef}
          aria-label={ariaLabel}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitDraft();
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              cancelDraft();
            }
          }}
        />
        <button
          className="mini-icon-button"
          type="button"
          aria-label={`Save ${ariaLabel}`}
          onClick={commitDraft}
        >
          <Check size={14} aria-hidden="true" />
        </button>
        <button
          className="mini-icon-button"
          type="button"
          aria-label={`Cancel ${ariaLabel}`}
          onClick={cancelDraft}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </span>
    );
  }

  return (
    <span className={`inline-text-edit ${className}`.trim()}>
      <span className="inline-text-edit-value">{displayValue}</span>
      <button
        ref={triggerRef}
        className="mini-icon-button"
        type="button"
        aria-label={ariaLabel}
        onClick={() => setIsEditing(true)}
      >
        <Pencil size={13} aria-hidden="true" />
      </button>
    </span>
  );
}
