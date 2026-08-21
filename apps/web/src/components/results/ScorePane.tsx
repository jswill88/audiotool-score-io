import { useLayoutEffect, useRef, useState } from 'react';
import type { SelectedProject } from '../../types';
import './ScorePane.css';

type ScorePaneProps = {
  assistiveDescription?: string;
  className?: string;
  emptyDescription?: string;
  emptyTitle?: string;
  id: string;
  labelledBy: string;
  role?: 'region' | 'tabpanel';
  selectedProject: SelectedProject | null;
  xml: string;
};

export function ScorePane({
  assistiveDescription = 'Score preview rendered from MusicXML. Use the XML tab to review the source text if the rendered notation is not available to your assistive technology.',
  className = '',
  emptyDescription,
  emptyTitle,
  id,
  labelledBy,
  role = 'tabpanel',
  selectedProject,
  xml
}: ScorePaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [renderError, setRenderError] = useState('');

  useLayoutEffect(() => {
    let cancelled = false;
    const target = containerRef.current;

    async function renderScore() {
      setRenderError('');

      if (!target) return;
      target.innerHTML = '';

      if (!xml) return;

      try {
        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');

        if (cancelled || !target.isConnected) {
          return;
        }

        const osmd = new OpenSheetMusicDisplay(target, {
          autoResize: true,
          backend: 'svg',
          drawTitle: true,
          followCursor: false
        });
        await osmd.load(xml);

        if (cancelled || !target.isConnected) {
          target.innerHTML = '';
          return;
        }

        osmd.render();
      } catch (error) {
        if (!cancelled) {
          setRenderError(error instanceof Error ? error.message : String(error));
        }
      }
    }

    renderScore();

    return () => {
      cancelled = true;
      if (target) {
        target.innerHTML = '';
      }
    };
  }, [xml]);

  if (!xml) {
    const emptyState = selectedProject?.details
      ? {
          title: 'No score yet',
          description: 'Select tracks and convert to preview the score.'
        }
      : {
          title: 'No project selected',
          description: 'Select a project to preview the score here.'
        };
    const resolvedEmptyState = {
      title: emptyTitle ?? emptyState.title,
      description: emptyDescription ?? emptyState.description
    };

    return (
      <div
        className={`score-empty ${className}`.trim()}
        id={id}
        role={role}
        aria-labelledby={labelledBy}
        tabIndex={0}
      >
        <div className="score-empty-copy">
          <strong>{resolvedEmptyState.title}</strong>
          <span>{resolvedEmptyState.description}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`score-surface ${className}`.trim()}
      id={id}
      role={role}
      aria-labelledby={labelledBy}
      tabIndex={0}
    >
      {renderError ? <div className="render-error" role="alert">{renderError}</div> : null}
      <p className="visually-hidden">{assistiveDescription}</p>
      <div ref={containerRef} />
    </div>
  );
}
