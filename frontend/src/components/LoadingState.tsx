import { Loader2 } from 'lucide-react';

export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <div
      className="panel panel-body"
      style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--muted)' }}
      role="status"
      aria-live="polite"
    >
      <Loader2 size={16} className="spin" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
