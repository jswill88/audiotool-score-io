import './XmlPane.css';

type XmlPaneProps = {
  id: string;
  labelledBy: string;
  xml: string;
};

export function XmlPane({ id, labelledBy, xml }: XmlPaneProps) {
  return (
    <pre
      className="xml-pane"
      id={id}
      role="tabpanel"
      aria-labelledby={labelledBy}
      tabIndex={0}
    >
      {xml || '<score-partwise />'}
    </pre>
  );
}
