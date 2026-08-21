import { useRef } from 'react';
import { ArrowRight, ExternalLink, FileMusic, Music2, Play, X } from 'lucide-react';
import demoVideoUrl from '../../assets/demo/demo.mp4?url';
import exportedScoreImage from '../../assets/demo/exported-score.png?url';
import importSourceScoreImage from '../../assets/demo/import-source-score.png?url';
import importedProjectImage from '../../assets/demo/imported-project.png?url';
import sourceProjectImage from '../../assets/demo/source-project.png?url';
import './PublicDemoShowcase.css';

const sourceTrackUrl = 'https://www.audiotool.com/track/9iu95sij';
const importedTrackUrl = 'https://www.audiotool.com/track/uisarryh';

export function PublicDemoShowcase() {
  const videoDialogRef = useRef<HTMLDialogElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoTriggerRef = useRef<HTMLButtonElement | null>(null);

  function openVideo() {
    const dialog = videoDialogRef.current;

    if (!dialog || dialog.open) {
      return;
    }

    dialog.showModal();
    void videoRef.current?.play().catch(() => undefined);
  }

  function closeVideo() {
    const dialog = videoDialogRef.current;

    if (dialog?.open) {
      dialog.close();
    }
  }

  function resetVideo() {
    const video = videoRef.current;

    if (video) {
      video.pause();
      video.currentTime = 0;
    }

    videoTriggerRef.current?.focus();
  }

  return (
    <section className="demo-showcase" aria-labelledby="demo-showcase-title">
      <div className="demo-showcase-heading">
        <h2 id="demo-showcase-title">Move music between Audiotool and notation</h2>
      </div>
      <div className="demo-grid">
        <article className="demo-card">
          <div className="demo-card-heading">
            <Music2 size={18} aria-hidden="true" />
            <div>
              <p className="demo-direction">Audiotool → MusicXML</p>
              <h3>Project to score</h3>
            </div>
          </div>
          <div className="demo-comparison">
            <div className="demo-stage">
              <div className="demo-stage-heading">
                <span>Before</span>
                <strong>Audiotool project</strong>
              </div>
              <img
                className="demo-stage-image"
                src={sourceProjectImage}
                alt="Audiotool Studio timeline for the source project"
              />
              <a
                className="icon-link demo-stage-link"
                href={sourceTrackUrl}
                target="_blank"
                rel="noreferrer"
                tabIndex={0}
              >
                <ExternalLink size={16} aria-hidden="true" />
                <span>Hear source</span>
              </a>
            </div>
            <div className="demo-connector" aria-hidden="true">
              <ArrowRight size={22} />
              <span>Convert</span>
            </div>
            <div className="demo-stage">
              <div className="demo-stage-heading">
                <span>After</span>
                <strong>MusicXML score</strong>
              </div>
              <img
                className="demo-stage-image"
                src={exportedScoreImage}
                alt="Readable notation generated from the Audiotool project"
              />
            </div>
          </div>
          <button
            ref={videoTriggerRef}
            className="demo-video-trigger"
            type="button"
            tabIndex={0}
            aria-haspopup="dialog"
            aria-controls="demo-video-dialog"
            aria-label="Watch the Audiotool to MusicXML conversion"
            onClick={openVideo}
          >
            <img src={exportedScoreImage} alt="" />
            <span className="demo-video-trigger-overlay">
              <span className="demo-video-play-icon" aria-hidden="true">
                <Play size={22} fill="currentColor" />
              </span>
              <strong>Watch the conversion</strong>
            </span>
          </button>
        </article>

        <article className="demo-card">
          <div className="demo-card-heading">
            <FileMusic size={18} aria-hidden="true" />
            <div>
              <p className="demo-direction">MusicXML → Audiotool</p>
              <h3>Score to project</h3>
            </div>
          </div>
          <div className="demo-comparison">
            <div className="demo-stage">
              <div className="demo-stage-heading">
                <span>Before</span>
                <strong>MusicXML score</strong>
              </div>
              <img
                className="demo-stage-image demo-source-score-image"
                src={importSourceScoreImage}
                alt="Notation from the bundled demo MusicXML score"
              />
            </div>
            <div className="demo-connector" aria-hidden="true">
              <ArrowRight size={22} />
              <span>Import</span>
            </div>
            <div className="demo-stage">
              <div className="demo-stage-heading">
                <span>After</span>
                <strong>New Audiotool project</strong>
              </div>
              <img
                className="demo-stage-image"
                src={importedProjectImage}
                alt="Audiotool Studio timeline for the project created from the score"
              />
              <a
                className="icon-link demo-stage-link"
                href={importedTrackUrl}
                target="_blank"
                rel="noreferrer"
                tabIndex={0}
              >
                <ExternalLink size={16} aria-hidden="true" />
                <span>Hear new project</span>
              </a>
            </div>
          </div>
        </article>
      </div>
      <dialog
        ref={videoDialogRef}
        className="demo-video-dialog"
        id="demo-video-dialog"
        aria-labelledby="demo-video-dialog-title"
        onClose={resetVideo}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeVideo();
          }
        }}
      >
        <div className="demo-video-dialog-shell">
          <div className="demo-video-dialog-heading">
            <div>
              <p className="demo-direction">Audiotool → MusicXML</p>
              <h2 id="demo-video-dialog-title">Watch the conversion</h2>
            </div>
            <button
              className="icon-button demo-video-close"
              type="button"
              tabIndex={0}
              aria-label="Close conversion video"
              onClick={closeVideo}
            >
              <X size={19} aria-hidden="true" />
            </button>
          </div>
          <video
            ref={videoRef}
            className="demo-video"
            controls
            playsInline
            preload="metadata"
            poster={exportedScoreImage}
            aria-label="Screen recording of an Audiotool project being converted into notation"
          >
            <source src={demoVideoUrl} type="video/mp4" />
            Your browser does not support the demo video.
          </video>
        </div>
      </dialog>
    </section>
  );
}
