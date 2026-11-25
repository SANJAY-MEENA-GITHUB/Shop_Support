import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageSquarePlus } from 'lucide-react';
import { api, formatDate, getErrorMessage, shortFolio } from '../../lib/api';
import { PaginatedResponse, TicketSummary } from '../../lib/types';
import { Layout } from '../../components/Layout';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';
import { Pagination } from '../../components/Pagination';

export function Tickets() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tickets', page],
    queryFn: async () =>
      (await api.get<PaginatedResponse<TicketSummary>>(`/tickets?page=${page}&limit=20`)).data,
  });

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>My tickets</h1>
          <p className="text-muted" style={{ marginTop: '4px', fontSize: '12px' }}>
            Open a ticket to chat with the AI support agent or review staff updates
          </p>
        </div>
        <Link to="/tickets/new" className="btn btn-primary">
          <MessageSquarePlus size={14} aria-hidden="true" />
          <span>Create ticket</span>
        </Link>
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />}

      {!isLoading && !error && data && (
        <>
          {data.data.length === 0 ? (
            <EmptyState
              message="No open tickets"
              action={
                <Link to="/tickets/new" className="btn btn-primary btn-sm">
                  Create ticket
                </Link>
              }
            />
          ) : (
            <div className="ledger-table-wrap">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Subject</th>
                    <th>Category</th>
                    <th>Order</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((ticket) => (
                    <tr key={ticket.id}>
                      <td data-label="Ticket">
                        <Link to={`/tickets/${ticket.id}`} className="folio-id">
                          {shortFolio('TKT', ticket.id)}
                        </Link>
                      </td>
                      <td data-label="Subject">
                        <Link to={`/tickets/${ticket.id}`}>{ticket.subject}</Link>
                      </td>
                      <td data-label="Category" className="text-muted">
                        {ticket.category.replace(/_/g, ' ')}
                      </td>
                      <td data-label="Order" className="text-muted">
                        {ticket.order?.displayId ?? '—'}
                      </td>
                      <td data-label="Priority">
                        <PriorityBadge priority={ticket.priority} />
                      </td>
                      <td data-label="Status">
                        <StatusBadge status={ticket.status} />
                      </td>
                      <td data-label="Updated" className="tabular text-muted">
                        {formatDate(ticket.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={data.page}
            limit={data.limit}
            total={data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </Layout>
  );
}
