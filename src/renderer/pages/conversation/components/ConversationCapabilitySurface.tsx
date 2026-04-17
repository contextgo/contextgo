import React from 'react';

type ConversationCapabilitySurfaceProps = {
  title: string;
  value?: string;
  emptyLabel?: string;
};

const ConversationCapabilitySurface: React.FC<ConversationCapabilitySurfaceProps> = ({ title, value, emptyLabel }) => {
  return (
    <div className='app-icon-row gap-6px text-12px text-t-secondary'>
      <span>{title}</span>
      <span className='truncate max-w-180px' title={value || emptyLabel}>
        {value || emptyLabel}
      </span>
    </div>
  );
};

export default ConversationCapabilitySurface;
