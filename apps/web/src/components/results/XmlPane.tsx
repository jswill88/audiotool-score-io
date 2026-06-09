import './XmlPane.css';

type XmlPaneProps = {
  xml: string;
};

export function XmlPane({ xml }: XmlPaneProps) {
  return (
    <pre className="xml-pane">{xml || '<score-partwise />'}</pre>
  );
}
