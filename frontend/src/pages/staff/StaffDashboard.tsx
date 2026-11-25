import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, formatCurrency, formatDate, getErrorMessage, shortFolio } from '../../lib/api';
import { EscalationItem, PaginatedResponse, RefundSummary, TicketSummary } from '../../lib/types';
import { Layout } from '../../components/Layout';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';

export function StaffDashboard() {
  const openTickets = useQuery({
    queryKey: ['staff', 'count', 'open'],
    queryFn: async () => (await api.get<PaginatedResponse<TicketSummary>>('/tickets?status=OPEN&limit=5')).data,
  });

  const escalatedTickets = useQuery({
    queryKey: ['staff', 'count', 'escalated'],
    queryFn: async () =>
      (await api.get<PaginatedResponse<TicketSummary>>('/tickets?status=ESCALATED&limit=5')).data,
  });

  const pendingEscalations = useQuery({
    queryKey: ['staff', 'count', 'escalations'],
    queryFn: async () =>
      (await api.get<PaginatedResponse<EscalationItem>>('/escalations?decision=PENDING&limit=5')).data,
  });

  const escalatedRefunds = useQuery({
    queryKey: ['staff', 'count', 'refunds'],
    queryFn: async () =>
      (await api.get<PaginatedResponse<RefundSummary>>('/refunds?status=ESCALATED&limit=5')).data,
  });

  const isLoading =
    openTickets.isLoading ||
    escalatedTickets.isLoading ||
    pendingEscalations.isLoading ||
    escalatedRefunds.isLoading;

  const firstError =
    openTickets.error ||
    escalatedTickets.error ||
    pendingEscalations.error ||
    escalatedRefunds.error;

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Support operations</h1>
          <p className="text-muted" style={{ marginTop: '4px', fontSize: '12px' }}>
            Live ticket queues, pending escalations, and refund review summary
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link to="/staff/tickets" className="btn">
            Ticket queue
          </Link>
          <Link to="/staff/escalations" className="btn btn-primary">
            Escalation queue
          </Link>
        </div>
      </div>

      {isLoading && <LoadingState />}
      {firstError && (
        <ErrorState
          message={getErrorMessage(firstError)}
          onRetry={() => {
            void openTickets.refetch();
            void escalatedTickets.refetch();
            void pendingEscalations.refetch();
            void escalatedRefunds.refetch();
          }}
        />
      )}

      {!isLoading && !firstError && (
        <>
          <div className="stats-grid">
            <div className="stat-cell">
              <div className="label">Open tickets</div>
              <div className="stat-value">{openTickets.data?.total ?? 0}</div>
            </div>
            <div className="stat-cell">
              <div className="label">Escalated tickets</div>
              <div className="stat-value text-amber">{escalatedTickets.data?.total ?? 0}</div>
            </div>
            <div className="stat-cell">
              <div className="label">Pending escalations</div>
              <div className="stat-value text-amber">{pendingEscalations.data?.total ?? 0}</div>
            </div>
            <div className="stat-cell">
              <div className="label">Escalated refunds</div>
              <div className="stat-value">{escalatedRefunds.data?.total ?? 0}</div>
            </div>
          </div>

          <section style={{ marginBottom: '24px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
              }}
            >
              <h2>Pending escalations</h2>
              <Link to="/staff/escalations" style={{ fontSize: '12px' }}>
                View all
              </Link>
            </div>
            {(pendingEscalations.data?.data ?? []).length === 0 ? (
              <EmptyState message="No pending escalations." />
            ) : (
              <div className="ledger-table-wrap">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>Escalation</th>
                      <th>Ticket</th>
                      <th>Customer</th>
                      <th>Priority</th>
                      <th>Decision</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pendingEscalations.data?.data ?? []).map((esc) => (
                      <tr key={esc.id}>
                        <td data-label="Escalation">
                          <Link to={`/staff/escalations/${esc.id}`} className="folio-id">
                            {shortFolio('ESC', esc.id)}
                          </Link>
                        </td>
                        <td data-label="Ticket">{esc.ticket?.subject ?? '—'}</td>
                        <td data-label="Customer" className="text-muted">
                          {esc.ticket?.customer?.name ?? '—'}
                        </td>
                        <td data-label="Priority">
                          <PriorityBadge priority={esc.priority} />
                        </td>
                        <td data-label="Decision">
                          <StatusBadge status={esc.decision} />
                        </td>
                        <td data-label="Created" className="tabular text-muted">
                          {formatDate(esc.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
              }}
            >
              <h2>Recent escalated refunds</h2>
              <Link to="/staff/refunds" style={{ fontSize: '12px' }}>
                View all
              </Link>
            </div>
            {(escalatedRefunds.data?.data ?? []).length === 0 ? (
              <EmptyState message="No refunds awaiting review." />
            ) : (
              <div className="ledger-table-wrap">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>Refund</th>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(escalatedRefunds.data?.data ?? []).map((r) => (
                      <tr key={r.id}>
                        <td data-label="Refund" className="folio-id">
                          {shortFolio('RFD', r.id)}
                        </td>
                        <td data-label="Order">{r.order?.displayId ?? '—'}</td>
                        <td data-label="Customer" className="text-muted">
                          {r.order?.customer?.name ?? '—'}
                        </td>
                        <td data-label="Status">
                          <StatusBadge status={r.status} />
                        </td>
                        <td data-label="Amount" className="num tabular">
                          {formatCurrency(r.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}
