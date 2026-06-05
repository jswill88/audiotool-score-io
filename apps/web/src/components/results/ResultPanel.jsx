import { Download, Eye, FileArchive } from 'lucide-react';
import { SectionTitle } from '../SectionTitle.jsx';
import { ResultTabs } from './ResultTabs.jsx';
import { ScorePane } from './ScorePane.jsx';
import { XmlPane } from './XmlPane.jsx';
import './ResultPanel.css';

export function ResultPanel({
  activeFile,
  activeFileName,
  activeResult,
  setActiveFileName,
  setViewerTab,
  viewerTab
}) {
  return (
    <section className="panel viewer-panel">
      <div className="viewer-header">
        <SectionTitle icon={<Eye size={17} />} title="Result" />
        <div className="viewer-actions">
          {activeResult?.downloadUrl ? (
            <a className="icon-link" href={activeResult.downloadUrl} download={activeResult.downloadName}>
              {activeResult.kind === 'zip'
                ? <FileArchive size={16} aria-hidden="true" />
                : <Download size={16} aria-hidden="true" />}
              <span>Download</span>
            </a>
          ) : null}
        </div>
      </div>

      <ResultTabs activeTab={viewerTab} onChange={setViewerTab} />

      {activeResult?.files?.length > 1 ? (
        <div className="file-strip">
          {activeResult.files.map((file) => (
            <button
              className={file.name === activeFile?.name ? 'is-active' : ''}
              key={file.name}
              type="button"
              onClick={() => setActiveFileName(file.name)}
            >
              {file.name}
            </button>
          ))}
        </div>
      ) : null}

      {viewerTab === 'score' ? (
        <ScorePane xml={activeFile?.xml ?? ''} />
      ) : (
        <XmlPane xml={activeFile?.xml ?? ''} />
      )}
    </section>
  );
}
