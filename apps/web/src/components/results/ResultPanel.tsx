import { Download, Eye, FileArchive } from 'lucide-react';
import { SectionTitle } from '../SectionTitle';
import { ResultTabs } from './ResultTabs';
import { ScorePane } from './ScorePane';
import { XmlPane } from './XmlPane';
import type {
  ActiveConversionResult,
  MusicXmlFile,
  SelectedProject,
  ViewerTab
} from '../../types';
import './ResultPanel.css';

type ResultPanelProps = {
  activeFile: MusicXmlFile | null;
  activeFileName: string;
  activeResult: ActiveConversionResult | null;
  selectedProject: SelectedProject | null;
  setActiveFileName: (fileName: string) => void;
  setViewerTab: (tab: ViewerTab) => void;
  viewerTab: ViewerTab;
};

export function ResultPanel({
  activeFile,
  activeFileName,
  activeResult,
  selectedProject,
  setActiveFileName,
  setViewerTab,
  viewerTab
}: ResultPanelProps) {
  const scorePaneKey = [
    selectedProject?.reference ?? 'no-project',
    activeResult?.downloadUrl ?? 'no-result',
    activeFile?.name ?? 'no-file'
  ].join(':');
  const files = activeResult?.files ?? [];

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

      {files.length > 1 ? (
        <div className="file-strip">
          {files.map((file) => (
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
        <ScorePane key={scorePaneKey} selectedProject={selectedProject} xml={activeFile?.xml ?? ''} />
      ) : (
        <XmlPane xml={activeFile?.xml ?? ''} />
      )}
    </section>
  );
}
