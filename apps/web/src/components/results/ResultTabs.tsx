import './ResultTabs.css';
import type { ViewerTab } from '../../types';

type ResultTabsProps = {
  activeTab: ViewerTab;
  onChange: (tab: ViewerTab) => void;
};

export function ResultTabs({ activeTab, onChange }: ResultTabsProps) {
  return (
    <div className="result-tabs">
      <button className={activeTab === 'score' ? 'is-active' : ''} type="button" onClick={() => onChange('score')}>
        Score
      </button>
      <button className={activeTab === 'xml' ? 'is-active' : ''} type="button" onClick={() => onChange('xml')}>
        XML
      </button>
    </div>
  );
}
