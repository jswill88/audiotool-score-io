import './ResultTabs.css';
import type { KeyboardEvent } from 'react';
import type { ViewerTab } from '../../types';

type ResultTabsProps = {
  activeTab: ViewerTab;
  scorePanelId: string;
  scoreTabId: string;
  onChange: (tab: ViewerTab) => void;
  xmlPanelId: string;
  xmlTabId: string;
};

export function ResultTabs({
  activeTab,
  scorePanelId,
  scoreTabId,
  onChange,
  xmlPanelId,
  xmlTabId
}: ResultTabsProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const nextTab = getNextTab(event.key, activeTab);

    if (!nextTab) {
      return;
    }

    event.preventDefault();
    onChange(nextTab);

    const nextId = nextTab === 'score' ? scoreTabId : xmlTabId;
    window.requestAnimationFrame(() => {
      document.getElementById(nextId)?.focus();
    });
  }

  return (
    <div
      className="result-tabs"
      role="tablist"
      aria-label="Result view"
      onKeyDown={handleKeyDown}
    >
      <button
        id={scoreTabId}
        aria-controls={scorePanelId}
        aria-selected={activeTab === 'score'}
        className={activeTab === 'score' ? 'is-active' : ''}
        role="tab"
        tabIndex={activeTab === 'score' ? 0 : -1}
        type="button"
        onClick={() => onChange('score')}
      >
        Score
      </button>
      <button
        id={xmlTabId}
        aria-controls={xmlPanelId}
        aria-selected={activeTab === 'xml'}
        className={activeTab === 'xml' ? 'is-active' : ''}
        role="tab"
        tabIndex={activeTab === 'xml' ? 0 : -1}
        type="button"
        onClick={() => onChange('xml')}
      >
        XML
      </button>
    </div>
  );
}

function getNextTab(key: string, activeTab: ViewerTab): ViewerTab | null {
  if (key === 'Home') {
    return 'score';
  }

  if (key === 'End') {
    return 'xml';
  }

  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return activeTab === 'score' ? 'xml' : 'score';
  }

  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return activeTab === 'score' ? 'xml' : 'score';
  }

  return null;
}
