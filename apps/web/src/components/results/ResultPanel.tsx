import { useId } from 'react';
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
  emptyDescription?: string;
  emptyTitle?: string;
  selectedProject: SelectedProject | null;
  setActiveFileName: (fileName: string) => void;
  setViewerTab: (tab: ViewerTab) => void;
  title?: string;
  viewerTab: ViewerTab;
};

export function ResultPanel({
  activeFile,
  activeFileName,
  activeResult,
  emptyDescription,
  emptyTitle,
  selectedProject,
  setActiveFileName,
  setViewerTab,
  title = 'Result',
  viewerTab
}: ResultPanelProps) {
  const resultTabsId = useId();
  const scoreTabId = `${resultTabsId}-score-tab`;
  const scorePanelId = `${resultTabsId}-score-panel`;
  const xmlTabId = `${resultTabsId}-xml-tab`;
  const xmlPanelId = `${resultTabsId}-xml-panel`;
  const scorePaneKey = [
    selectedProject?.reference ?? 'no-project',
    activeResult?.downloadUrl ?? 'no-result',
    activeFile?.name ?? 'no-file'
  ].join(':');
  const files = activeResult?.files ?? [];

  return (
    <section className="panel viewer-panel">
      <div className="viewer-header">
        <SectionTitle icon={<Eye size={17} />} title={title} />
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

      <ResultTabs
        activeTab={viewerTab}
        scorePanelId={scorePanelId}
        scoreTabId={scoreTabId}
        onChange={setViewerTab}
        xmlPanelId={xmlPanelId}
        xmlTabId={xmlTabId}
      />

      {files.length > 1 ? (
        <div className="file-strip" role="group" aria-label="Converted MusicXML files">
          {files.map((file) => {
            const isActiveFile = file.name === activeFile?.name;

            return (
              <button
                aria-pressed={isActiveFile}
                className={isActiveFile ? 'is-active' : ''}
                key={file.name}
                type="button"
                onClick={() => setActiveFileName(file.name)}
              >
                {file.name}
              </button>
            );
          })}
        </div>
      ) : null}

      {viewerTab === 'score' ? (
        <ScorePane
          key={scorePaneKey}
          emptyDescription={emptyDescription}
          emptyTitle={emptyTitle}
          id={scorePanelId}
          labelledBy={scoreTabId}
          selectedProject={selectedProject}
          xml={activeFile?.xml ?? ''}
        />
      ) : (
        <XmlPane id={xmlPanelId} labelledBy={xmlTabId} xml={activeFile?.xml ?? ''} />
      )}
    </section>
  );
}
