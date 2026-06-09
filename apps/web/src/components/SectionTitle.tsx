import type { ReactNode } from 'react';
import './SectionTitle.css';

type SectionTitleProps = {
  icon: ReactNode;
  title: string;
};

export function SectionTitle({ icon, title }: SectionTitleProps) {
  return (
    <div className="section-title">
      {icon}
      <h2>{title}</h2>
    </div>
  );
}
