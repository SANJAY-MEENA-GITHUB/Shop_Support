import { CheckCircle2, Circle, Clock, XCircle } from 'lucide-react';
import { RefundSummary } from '../lib/types';
import { formatCurrency, formatDateTime, shortFolio } from '../lib/api';
import { StatusBadge } from './StatusBadge';

export function RefundTimeline({ refund }: { refund: RefundSummary }) {
  const isEscalated = refund.status === 'ESCALATED';
  const isRejected = refund.status === 'REJECTED';
  const isFailed = refund.status === 'FAILED';
  const isProcessed = refund.status === 'PROCESSED';
  const isApproved = refund.status === 'APPROVED' || isProcessed;

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '12px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
          gap: '8px',
        }}
      >
        <span className="folio-id">{shortFolio('RFD', refund.id)}</span>
        <StatusBadge status={refund.status} />
      </div>

      <div style={{ fontSize: '12px', marginBottom: '10px' }}>
        <div className="tabular">Amount: {formatCurrency(refund.amount)}</div>
        <div className="text-muted">Reason: {refund.reason}</div>
        {refund.paymentRef && (
          <div className="text-signal tabular">Payment Ref: {refund.paymentRef}</div>
        )}
        <div className="text-muted tabular">Requested: {formatDateTime(refund.createdAt)}</div>
      </div>

      <div className="timeline">
        <div className="timeline-step done">
          <CheckCircle2 size={14} aria-hidden="true" />
          <span>1. Requested</span>
        </div>

        <div className={`timeline-step ${isEscalated ? 'warn' : 'done'}`}>
          {isEscalated ? <Clock size={14} aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
          <span>{isEscalated ? '2. Escalated for human review' : '2. Policy & eligibility review'}</span>
        </div>

        <div
          className={`timeline-step ${
            isRejected ? 'fail' : isApproved ? 'done' : isEscalated ? 'warn' : ''
          }`}
        >
          {isRejected ? (
            <XCircle size={14} aria-hidden="true" />
          ) : isApproved ? (
            <CheckCircle2 size={14} aria-hidden="true" />
          ) : (
            <Circle size={14} aria-hidden="true" />
          )}
          <span>{isRejected ? '3. Rejected' : '3. Approved'}</span>
        </div>

        <div
          className={`timeline-step ${
            isFailed ? 'fail' : isProcessed ? 'done' : ''
          }`}
        >
          {isFailed ? (
            <XCircle size={14} aria-hidden="true" />
          ) : isProcessed ? (
            <CheckCircle2 size={14} aria-hidden="true" />
          ) : (
            <Circle size={14} aria-hidden="true" />
          )}
          <span>{isFailed ? '4. Execution failed' : '4. Processed'}</span>
        </div>
      </div>
    </div>
  );
}
