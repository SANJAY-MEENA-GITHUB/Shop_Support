import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api, formatCurrency, formatDate, getErrorMessage, shortFolio } from '../../lib/api';
import { EscalationDecision, EscalationItem, PaginatedResponse } from '../../lib/types';
import { Layout } from '../../components/Layout';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';
import { Pagination } from '../../components/Pagination';
import { ChatThread } from '../../components/ChatThread';
import { RefundTimeline } from '../../components/RefundTimeline';

export function Escalations() {
  const { id } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();

  const [decisionFilter, setDecisionFilter] = useState<EscalationDecision | ''>('');
  const [page, setPage] = useState(1);
  const [internalNote, setInternalNote] = useState('');

  const listQuery = useQuery({
    queryKey: ['staff', 'escalations', decisionFilter, page],
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(decisionFilter ? { decision: decisionFilter } : {}),
      });
      return (await api.get<PaginatedResponse<EscalationItem>>(`/escalations?${qs.toString()}`)).data;
    },
    enabled: !id,
  });

  const detailQuery = useQuery({
    queryKey: ['staff', 'escalation', id],
    queryFn: async () => (await api.get<EscalationItem>(`/escalations/${id}`)).data,
    enabled: Boolean(id),
  });

  const decideMutation = useMutation({
    mutationFn: async (decision: 'APPROVED' | 'REJECTED' | 'NEEDS_INFO') =>
      api.patch(`/escalations/${id}/decision`, {
        decision,
        ...(internalNote.trim() ? { internalNote: internalNote.trim() } : {}),
      }),
    onSuccess: () => {
      setInternalNote('');
      void queryClient.invalidateQueries({ queryKey: ['staff', 'escalation', id] });
      void queryClient.invalidateQueries({ queryKey: ['staff', 'escalations'] });
      void queryClient.invalidateQueries({ queryKey: ['staff', 'count'] });
    },
  });

  if (id) {
    const esc = detailQuery.data;
    const canDecide = esc?.decision === 'PENDING' || esc?.decision === 'NEEDS_INFO';

    return (
      <Layout>
        <div style={{ marginBottom: '16px' }}>
          <Link to="/staff/escalations" className="btn btn-sm">
            <ArrowLeft size={13} aria-hidden="true" />
            <span>Back to escalations</span>
          </Link>
        </div>

        {detailQuery.isLoading && <LoadingState />}
        {detailQuery.error && (
          <ErrorState
            message={getErrorMessage(detailQuery.error)}
            onRetry={() => void detailQuery.refetch()}
          />
        )}

        {esc && (
          <>
            <div className="page-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span className="folio-id text-muted">{shortFolio('ESC', esc.id)}</span>
                  <h1>Escalation review</h1>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                  <StatusBadge status={esc.decision} />
                  <PriorityBadge priority={esc.priority} />
                  <span className="text-muted tabular" style={{ fontSize: '12px' }}>
                    Created {formatDate(esc.createdAt)}
                  </span>
                </div>
              </div>
              {esc.ticket && (
                <Link to={`/staff/tickets/${esc.ticket.id}`} className="btn btn-sm">
                  Open linked ticket
                </Link>
              )}
            </div>

            <div className="detail-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <section className="panel">
                  <div className="panel-header">
                    <h2>Escalation summary</h2>
                  </div>
                  <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <p>{esc.summary}</p>
                    {esc.internalNote && (
                      <div className="text-muted" style={{ fontSize: '12px' }}>
                        Last note: {esc.internalNote}
                      </div>
                    )}
                  </div>
                </section>

                {esc.ticket?.messages && (
                  <section className="panel">
                    <div className="panel-header">
                      <h2>Conversation context</h2>
                    </div>
                    <ChatThread messages={esc.ticket.messages} />
                  </section>
                )}
              </div>

              <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="panel">
                  <div className="panel-header">
                    <h2>Staff decision</h2>
                  </div>
                  <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {decideMutation.isError && (
                      <div className="banner-error">{getErrorMessage(decideMutation.error)}</div>
                    )}
                    {decideMutation.isSuccess && (
                      <div className="banner-success">Escalation decision recorded.</div>
                    )}

                    {canDecide ? (
                      <>
                        <div>
                          <label className="label" htmlFor="esc-note">
                            Internal / review note (optional)
                          </label>
                          <textarea
                            id="esc-note"
                            className="textarea"
                            value={internalNote}
                            onChange={(e) => setInternalNote(e.target.value)}
                            placeholder="Add justification or follow-up request..."
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => decideMutation.mutate('APPROVED')}
                          disabled={decideMutation.isPending}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-amber"
                          onClick={() => decideMutation.mutate('NEEDS_INFO')}
                          disabled={decideMutation.isPending}
                        >
                          Request info
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => decideMutation.mutate('REJECTED')}
                          disabled={decideMutation.isPending}
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <p className="text-muted" style={{ fontSize: '12px' }}>
                        This escalation has been finalized as {esc.decision}.
                      </p>
                    )}
                  </div>
                </div>

                {esc.ticket?.order && (
                  <div className="panel">
                    <div className="panel-header">
                      <h2>Order</h2>
                      <span className="folio-id">{esc.ticket.order.displayId}</span>
                    </div>
                    <div className="panel-body" style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div>Status: {esc.ticket.order.status}</div>
                      <div className="tabular">
                        Total: {formatCurrency(esc.ticket.order.totalAmount)}
                      </div>
                      <div className="tabular">
                        Delivered: {formatDate(esc.ticket.order.deliveryDate)}
                      </div>
                    </div>
                  </div>
                )}

                {esc.ticket?.refunds && esc.ticket.refunds.length > 0 && (
                  <div className="panel">
                    <div className="panel-header">
                      <h2>Linked refunds</h2>
                    </div>
                    <div className="panel-body">
                      {esc.ticket.refunds.map((r) => (
                        <RefundTimeline key={r.id} refund={r} />
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

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Escalation queue</h1>
          <p className="text-muted" style={{ marginTop: '4px', fontSize: '12px' }}>
            Review high-value refunds (&gt; ₹5,000) and human handoffs
          </p>
        </div>
      </div>

      <div className="filters-bar">
        <div style={{ maxWidth: '240px' }}>
          <label className="label" htmlFor="esc-decision-filter">
            Decision
          </label>
          <select
            id="esc-decision-filter"
            className="select"
            value={decisionFilter}
            onChange={(e) => {
              setDecisionFilter(e.target.value as EscalationDecision | '');
              setPage(1);
            }}
          >
            <option value="">All decisions</option>
            <option value="PENDING">PENDING</option>
            <option value="NEEDS_INFO">NEEDS_INFO</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </div>
      </div>

      {listQuery.isLoading && <LoadingState />}
      {listQuery.error && (
        <ErrorState
          message={getErrorMessage(listQuery.error)}
          onRetry={() => void listQuery.refetch()}
        />
      )}

      {!listQuery.isLoading && !listQuery.error && listQuery.data && (
        <>
          {listQuery.data.data.length === 0 ? (
            <EmptyState message="No escalations in this view." />
          ) : (
            <div className="ledger-table-wrap">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Escalation</th>
                    <th>Summary</th>
                    <th>Customer</th>
                    <th>Order</th>
                    <th>Priority</th>
                    <th>Decision</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {listQuery.data.data.map((esc) => (
                    <tr key={esc.id}>
                      <td data-label="Escalation">
                        <Link to={`/staff/escalations/${esc.id}`} className="folio-id">
                          {shortFolio('ESC', esc.id)}
                        </Link>
                      </td>
                      <td data-label="Summary">{esc.summary}</td>
                      <td data-label="Customer" className="text-muted">
                        {esc.ticket?.customer?.name ?? '—'}
                      </td>
                      <td data-label="Order" className="text-muted">
                        {esc.ticket?.order?.displayId ?? '—'}
                      </td>
                      <td data-label="Priority">
                        <PriorityBadge priority={esc.priority} />
                      </td>
                      <td data-label="Decision">
                        <StatusBadge status={esc.decision} />
                      </td>
                      <td data-label="Action">
                        <Link to={`/staff/escalations/${esc.id}`} className="btn btn-sm btn-primary">
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={listQuery.data.page}
            limit={listQuery.data.limit}
            total={listQuery.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </Layout>
  );
}
