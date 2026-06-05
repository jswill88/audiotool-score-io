import { useEffect, useRef, useState } from 'react';
import '../StaffPreview.css';
import './ScorePane.css';

export function ScorePane({ xml }) {
  const containerRef = useRef(null);
  const [renderError, setRenderError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function renderScore() {
      setRenderError('');

      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';

      if (!xml) return;

      try {
        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');
        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          backend: 'svg',
          drawTitle: true,
          followCursor: false
        });
        await osmd.load(xml);

        if (cancelled) return;
        osmd.render();
      } catch (error) {
        if (!cancelled) {
          setRenderError(error.message);
        }
      }
    }

    renderScore();

    return () => {
      cancelled = true;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [xml]);

  if (!xml) {
    return (
      <div className="score-empty">
        <div className="staff-preview large" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
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
