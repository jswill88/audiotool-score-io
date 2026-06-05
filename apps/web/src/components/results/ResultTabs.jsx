import './ResultTabs.css';

export function ResultTabs({ activeTab, onChange }) {
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
