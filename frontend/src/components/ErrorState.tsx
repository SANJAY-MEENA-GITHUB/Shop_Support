import { AlertTriangle } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="banner-error" role="alert">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <AlertTriangle size={16} aria-hidden="true" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button type="button" className="btn btn-danger btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
