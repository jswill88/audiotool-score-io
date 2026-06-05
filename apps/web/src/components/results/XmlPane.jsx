import './XmlPane.css';

export function XmlPane({ xml }) {
  return (
    <pre className="xml-pane">{xml || '<score-partwise />'}</pre>
  );
}
