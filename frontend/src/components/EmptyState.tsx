import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  message: string;
  action?: React.ReactNode;
}

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div
      className="panel panel-body"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '28px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--muted)' }}>
        <Inbox size={18} aria-hidden="true" />
        <span>{message}</span>
      </div>
      {action}
    </div>
  );
}
