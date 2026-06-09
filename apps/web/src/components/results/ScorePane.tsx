import { useLayoutEffect, useRef, useState } from 'react';
import type { SelectedProject } from '../../types';
import './ScorePane.css';

type ScorePaneProps = {
  selectedProject: SelectedProject | null;
  xml: string;
};

export function ScorePane({ selectedProject, xml }: ScorePaneProps) {
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

    return (
      <div className="score-empty">
        <div className="score-empty-copy">
          <strong>{emptyState.title}</strong>
          <span>{emptyState.description}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="score-surface">
      {renderError ? <div className="render-error">{renderError}</div> : null}
      <div ref={containerRef} />
    </div>
  );
}
