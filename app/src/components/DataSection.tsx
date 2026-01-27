import { ReactNode } from 'react';

interface DataSectionProps {
  title: string;
  children: ReactNode;
}

function DataSection({ title, children }: DataSectionProps) {
  return (
    <div id="data-section">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export default DataSection;
