import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api, formatCurrency, getErrorMessage } from '../lib/api';
import { RefundSummary } from '../lib/types';

interface RefundModalProps {
  orderId: string;
  orderDisplayId: string;
  maxAmount: number;
  ticketId?: string;
  onClose: () => void;
  onSuccess?: (refund: RefundSummary) => void;
}

export function RefundModal({
  orderId,
  orderDisplayId,
  maxAmount,
  ticketId,
  onClose,
  onSuccess,
}: RefundModalProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(maxAmount > 0 ? String(maxAmount) : '');
  const [reason, setReason] = useState('');
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<RefundSummary>('/refunds', {
        orderId,
        amount: Number(amount),
        reason: reason.trim(),
        idempotencyKey,
        ...(ticketId ? { ticketId } : {}),
      });
      return res.data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['refunds'] });
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      if (ticketId) {
        void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      }
      onSuccess?.(data);
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setValidationError('Enter a valid amount greater than ₹0.');
      return;
    }
    if (reason.trim().length < 10 || reason.trim().length > 500) {
      setValidationError('Reason must be between 10 and 500 characters.');
      return;
    }
    setValidationError(null);
    mutation.mutate();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="refund-modal-title">
      <div className="modal-box">
        <div className="panel-header">
          <h2 id="refund-modal-title">Request refund — {orderDisplayId}</h2>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={14} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="text-muted" style={{ fontSize: '12px' }}>
            Refundable balance: <span className="tabular text-text">{formatCurrency(maxAmount)}</span>. Amounts above ₹5,000 require staff review.
          </div>

          {validationError && <div className="banner-error">{validationError}</div>}
          {mutation.isError && (
            <div className="banner-error">{getErrorMessage(mutation.error)}</div>
          )}

          <div>
            <label className="label" htmlFor="refund-amount">
              Amount (INR)
            </label>
            <input
              id="refund-amount"
              className="input tabular"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="refund-reason">
              Reason (10–500 characters)
            </label>
            <textarea
              id="refund-reason"
              className="textarea"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the issue with the order item..."
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Submitting…' : 'Request refund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
