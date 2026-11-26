import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send } from 'lucide-react';
import { api, formatCurrency, formatDate, formatDateTime, getErrorMessage, shortFolio } from '../../lib/api';
import { InternalNoteItem, Priority, TicketDetail, TicketStatus } from '../../lib/types';
import { Layout } from '../../components/Layout';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';
import { ChatThread } from '../../components/ChatThread';
import { RefundTimeline } from '../../components/RefundTimeline';

const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED'],
  IN_PROGRESS: ['IN_PROGRESS', 'RESOLVED', 'ESCALATED'],
  ESCALATED: ['ESCALATED', 'IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['RESOLVED', 'CLOSED'],
  CLOSED: ['CLOSED'],
};

export function StaffTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<TicketStatus>('IN_PROGRESS');
  const [priority, setPriority] = useState<Priority>('MEDIUM');

  const ticketQuery = useQuery({
    queryKey: ['staff', 'ticket', id],
    queryFn: async () => (await api.get<TicketDetail>(`/tickets/${id}`)).data,
    enabled: Boolean(id),
  });

  const notesQuery = useQuery({
    queryKey: ['staff', 'ticket', id, 'notes'],
    queryFn: async () =>
      (await api.get<{ data: InternalNoteItem[] }>(`/tickets/${id}/notes`)).data.data,
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (ticketQuery.data) {
      setStatus(ticketQuery.data.status);
      setPriority(ticketQuery.data.priority);
    }
  }, [ticketQuery.data]);

  const replyMutation = useMutation({
    mutationFn: async (content: string) =>
      api.post(`/tickets/${id}/messages`, { content }),
    onSuccess: () => {
      setReply('');
      void queryClient.invalidateQueries({ queryKey: ['staff', 'ticket', id] });
    },
  });

  const noteMutation = useMutation({
    mutationFn: async (content: string) =>
      api.post(`/tickets/${id}/notes`, { content }),
    onSuccess: () => {
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ['staff', 'ticket', id, 'notes'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async () =>
      api.patch(`/tickets/${id}/status`, { status, priority }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff', 'ticket', id] });
      void queryClient.invalidateQueries({ queryKey: ['staff', 'tickets'] });
    },
  });

  const ticket = ticketQuery.data;

  return (
    <Layout>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/staff/tickets" className="btn btn-sm">
          <ArrowLeft size={13} aria-hidden="true" />
          <span>Back to queue</span>
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
                  Customer: {ticket.customer?.name} ({ticket.customer?.email})
                </span>
              </div>
            </div>
          </div>

          <div className="detail-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <section className="panel">
                <div className="panel-header">
                  <h2>Conversation thread</h2>
                </div>
                <ChatThread messages={ticket.messages} />
                <form
                  onSubmit={(e: React.FormEvent) => {
                    e.preventDefault();
                    if (!reply.trim()) return;
                    replyMutation.mutate(reply.trim());
                  }}
                  style={{
                    borderTop: '1px solid var(--border)',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  {replyMutation.isError && (
                    <div className="banner-error">{getErrorMessage(replyMutation.error)}</div>
                  )}
                  <label className="label" htmlFor="staff-reply">
                    Reply to customer
                  </label>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <input
                      id="staff-reply"
                      className="input"
                      style={{ flex: '1 1 240px' }}
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Write a customer-visible reply..."
                    />
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={!reply.trim() || replyMutation.isPending}
                    >
                      <Send size={14} aria-hidden="true" />
                      <span>{replyMutation.isPending ? 'Sending…' : 'Send reply'}</span>
                    </button>
                  </div>
                </form>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <h2>Internal notes (staff only)</h2>
                </div>
                <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(notesQuery.data ?? []).length === 0 ? (
                    <p className="text-muted" style={{ fontSize: '12px' }}>
                      No internal notes recorded yet.
                    </p>
                  ) : (
                    (notesQuery.data ?? []).map((n) => (
                      <div
                        key={n.id}
                        style={{
                          border: '1px solid var(--border)',
                          padding: '10px 12px',
                          background: 'var(--surface-2)',
                        }}
                      >
                        <div className="chat-meta">
                          <span>{n.author?.name ?? 'Staff'}</span>
                          <span className="tabular">{formatDateTime(n.createdAt)}</span>
                        </div>
                        <div className="chat-content">{n.content}</div>
                      </div>
                    ))
                  )}

                  {noteMutation.isError && (
                    <div className="banner-error">{getErrorMessage(noteMutation.error)}</div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!note.trim()) return;
                      noteMutation.mutate(note.trim());
                    }}
                    style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}
                  >
                    <input
                      className="input"
                      style={{ flex: '1 1 240px' }}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add internal note (not visible to customer)..."
                      aria-label="Internal note"
                    />
                    <button
                      type="submit"
                      className="btn"
                      disabled={!note.trim() || noteMutation.isPending}
                    >
                      {noteMutation.isPending ? 'Saving…' : 'Add note'}
                    </button>
                  </form>
                </div>
              </section>
            </div>

            <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="panel">
                <div className="panel-header">
                  <h2>Triage controls</h2>
                </div>
                <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {statusMutation.isError && (
                    <div className="banner-error">{getErrorMessage(statusMutation.error)}</div>
                  )}
                  {statusMutation.isSuccess && (
                    <div className="banner-success">Ticket updated.</div>
                  )}
                  <div>
                    <label className="label" htmlFor="staff-status">
                      Status
                    </label>
                    <select
                      id="staff-status"
                      className="select"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as TicketStatus)}
                    >
                      {ALLOWED_TRANSITIONS[ticket.status].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="staff-priority">
                      Priority
                    </label>
                    <select
                      id="staff-priority"
                      className="select"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as Priority)}
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="URGENT">URGENT</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => statusMutation.mutate()}
                    disabled={statusMutation.isPending}
                  >
                    {statusMutation.isPending ? 'Updating…' : 'Update ticket'}
                  </button>
                </div>
              </div>

              {ticket.order && (
                <div className="panel">
                  <div className="panel-header">
                    <h2>Order context</h2>
                    <span className="folio-id">{ticket.order.displayId}</span>
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
                  </div>
                </div>
              )}

              {ticket.refunds.length > 0 && (
                <div className="panel">
                  <div className="panel-header">
                    <h2>Refunds</h2>
                  </div>
                  <div className="panel-body">
                    {ticket.refunds.map((r) => (
                      <RefundTimeline key={r.id} refund={r} />
                    ))}
                  </div>
                </div>
              )}

              {ticket.escalations.length > 0 && (
                <div className="panel">
                  <div className="panel-header">
                    <h2>Escalations</h2>
                  </div>
                  <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                    {ticket.escalations.map((esc) => (
                      <div key={esc.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <StatusBadge status={esc.decision} />
                          <Link to={`/staff/escalations/${esc.id}`}>Review</Link>
                        </div>
                        <p className="text-muted">{esc.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </Layout>
  );
}
