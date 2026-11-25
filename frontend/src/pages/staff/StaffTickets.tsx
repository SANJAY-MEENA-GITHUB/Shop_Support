import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, formatDate, getErrorMessage, shortFolio } from '../../lib/api';
import { PaginatedResponse, Priority, TicketStatus, TicketSummary } from '../../lib/types';
import { Layout } from '../../components/Layout';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';
import { Pagination } from '../../components/Pagination';

export function StaffTickets() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'priority'>('newest');
  const [page, setPage] = useState(1);

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: '20',
    sort,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['staff', 'tickets', search, status, priority, sort, page],
    queryFn: async () =>
      (await api.get<PaginatedResponse<TicketSummary>>(`/tickets?${queryParams.toString()}`)).data,
  });

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Ticket triage</h1>
          <p className="text-muted" style={{ marginTop: '4px', fontSize: '12px' }}>
            Search, filter, and inspect customer support conversations
          </p>
        </div>
      </div>

      <div className="filters-bar">
        <div>
          <label className="label" htmlFor="filter-search">
            Search
          </label>
          <input
            id="filter-search"
            className="input"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Subject, ticket ID, ORD-..."
          />
        </div>
        <div>
          <label className="label" htmlFor="filter-status">
            Status
          </label>
          <select
            id="filter-status"
            className="select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as TicketStatus | '');
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="ESCALATED">ESCALATED</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="filter-priority">
            Priority
          </label>
          <select
            id="filter-priority"
            className="select"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value as Priority | '');
              setPage(1);
            }}
          >
            <option value="">All priorities</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="URGENT">URGENT</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="filter-sort">
            Sort
          </label>
          <select
            id="filter-sort"
            className="select"
            value={sort}
            onChange={(e) => setSort(e.target.value as 'newest' | 'oldest' | 'priority')}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="priority">Priority</option>
          </select>
        </div>
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />}

      {!isLoading && !error && data && (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No tickets match the current filters." />
          ) : (
            <div className="ledger-table-wrap">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Subject</th>
                    <th>Customer</th>
                    <th>Order</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((ticket) => (
                    <tr key={ticket.id}>
                      <td data-label="Ticket">
                        <Link to={`/staff/tickets/${ticket.id}`} className="folio-id">
                          {shortFolio('TKT', ticket.id)}
                        </Link>
                      </td>
                      <td data-label="Subject">
                        <Link to={`/staff/tickets/${ticket.id}`}>{ticket.subject}</Link>
                      </td>
                      <td data-label="Customer" className="text-muted">
                        {ticket.customer?.name ?? '—'}
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
                      <td data-label="Created" className="tabular text-muted">
                        {formatDate(ticket.createdAt)}
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
