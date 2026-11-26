import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, ShieldAlert } from 'lucide-react';
import { api, formatCurrency, formatDate, getErrorMessage, shortFolio } from '../../lib/api';
import { ChatResponse, TicketDetail as TicketDetailType } from '../../lib/types';
import { Layout } from '../../components/Layout';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';
import { ChatThread } from '../../components/ChatThread';
import { RefundTimeline } from '../../components/RefundTimeline';
import { RefundModal } from '../../components/RefundModal';

export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [showRefundModal, setShowRefundModal] = useState(false);

  const ticketQuery = useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => (await api.get<TicketDetailType>(`/tickets/${id}`)).data,
    enabled: Boolean(id),
  });

  const chatMutation = useMutation({
    mutationFn: async (text: string) =>
      (await api.post<ChatResponse>('/chat', { ticketId: id, message: text })).data,
    onSuccess: () => {
      setMessage('');
      void queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      void queryClient.invalidateQueries({ queryKey: ['refunds'] });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: async () =>
      api.post(`/tickets/${id}/escalate`, {
        summary: 'Customer requested human support review from ticket thread.',
        priority: 'MEDIUM',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    },
  });

  const ticket = ticketQuery.data;
  const isClosed = ticket?.status === 'RESOLVED' || ticket?.status === 'CLOSED';

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isClosed) return;
    chatMutation.mutate(message.trim());
  };

  return (
    <Layout>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/tickets" className="btn btn-sm">
          <ArrowLeft size={13} aria-hidden="true" />
          <span>Back to tickets</span>
        </Link>
      </div>

      {ticketQuery.isLoading && <LoadingState />}
      {ticketQuery.error && (
        <ErrorState
          message={getErrorMessage(ticketQuery.error)}
          onRetry={() => void ticketQuery.refetch()}
        />
      )}

      {ticket && (
        <>
          <div className="page-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span className="folio-id text-muted">{shortFolio('TKT', ticket.id)}</span>
                <h1>{ticket.subject}</h1>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                <span className="text-muted" style={{ fontSize: '12px' }}>
                  {ticket.category.replace(/_/g, ' ')} · Opened {formatDate(ticket.createdAt)}
                </span>
              </div>
            </div>

            {!isClosed && ticket.status !== 'ESCALATED' && (
              <button
                type="button"
                className="btn btn-amber btn-sm"
                onClick={() => escalateMutation.mutate()}
                disabled={escalateMutation.isPending}
              >
                <ShieldAlert size={13} aria-hidden="true" />
                <span>{escalateMutation.isPending ? 'Escalating…' : 'Request human review'}</span>
              </button>
            )}
          </div>

          <div className="detail-grid">
            {/* Conversation + AI Chat Input */}
            <section className="panel">
              <div className="panel-header">
                <h2>Support conversation</h2>
                <span className="text-muted" style={{ fontSize: '11px' }}>
                  AI Agent + Staff Thread
                </span>
              </div>

              <ChatThread messages={ticket.messages} />

              <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px' }}>
                {chatMutation.isError && (
                  <div className="banner-error" style={{ marginBottom: '10px' }}>
                    {getErrorMessage(chatMutation.error)}
                  </div>
                )}
                {escalateMutation.isError && (
                  <div className="banner-error" style={{ marginBottom: '10px' }}>
                    {getErrorMessage(escalateMutation.error)}
                  </div>
                )}

                {isClosed ? (
                  <div className="text-muted" style={{ fontSize: '12px' }}>
                    This ticket is {ticket.status.toLowerCase()}.{' '}
                    <Link to="/tickets/new">Create a new ticket</Link> if you need further help.
                  </div>
                ) : (
                  <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <input
                      className="input"
                      style={{ flex: '1 1 240px' }}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Message AI support (e.g. 'Refund ORD-1001' or ask a question)..."
                      aria-label="Chat message"
                      disabled={chatMutation.isPending}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={!message.trim() || chatMutation.isPending}
                    >
                      <Send size={14} aria-hidden="true" />
                      <span>{chatMutation.isPending ? 'Sending…' : 'Send'}</span>
                    </button>
                  </form>
                )}
              </div>
            </section>

            {/* Right Context Sidebar */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {ticket.order && (
                <div className="panel">
                  <div className="panel-header">
                    <h2>Order context</h2>
                    <Link to={`/orders/${ticket.order.id}`} className="folio-id">
                      {ticket.order.displayId}
                    </Link>
                  </div>
                  <div className="panel-body" style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-muted">Status</span>
                      <StatusBadge status={ticket.order.status} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-muted">Delivered</span>
                      <span className="tabular">{formatDate(ticket.order.deliveryDate)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-muted">Total</span>
                      <span className="tabular">{formatCurrency(ticket.order.totalAmount)}</span>
                    </div>
                    {ticket.order.status === 'DELIVERED' &&
                      !ticket.refunds.some((r) =>
                        ['PENDING_REVIEW', 'APPROVED', 'ESCALATED', 'PROCESSED'].includes(r.status)
                      ) && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: '6px' }}
                        onClick={() => setShowRefundModal(true)}
                      >
                        Request refund
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="panel">
                <div className="panel-header">
                  <h2>Refund progress</h2>
                </div>
                <div className="panel-body">
                  {ticket.refunds.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: '12px' }}>
                      No refunds linked to this ticket.
                    </p>
                  ) : (
                    ticket.refunds.map((r) => <RefundTimeline key={r.id} refund={r} />)
                  )}
                </div>
              </div>

              {ticket.escalations.length > 0 && (
                <div className="panel">
                  <div className="panel-header">
                    <h2>Escalation status</h2>
                  </div>
                  <div className="panel-body" style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {ticket.escalations.map((esc) => (
                      <div key={esc.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <StatusBadge status={esc.decision} />
                          <PriorityBadge priority={esc.priority} />
                        </div>
                        <p className="text-muted">{esc.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>

          {showRefundModal && ticket.order && (
            <RefundModal
              orderId={ticket.order.id}
              orderDisplayId={ticket.order.displayId}
              maxAmount={ticket.order.totalAmount}
              ticketId={ticket.id}
              onClose={() => setShowRefundModal(false)}
            />
          )}
        </>
      )}
    </Layout>
  );
}
