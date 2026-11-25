import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api, formatCurrency, formatDate, getErrorMessage, shortFolio } from '../../lib/api';
import { PaginatedResponse, RefundSummary } from '../../lib/types';
import { Layout } from '../../components/Layout';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { Pagination } from '../../components/Pagination';
import { RefundTimeline } from '../../components/RefundTimeline';

export function Refunds() {
  const { id } = useParams<{ id?: string }>();
  const [page, setPage] = useState(1);

  const listQuery = useQuery({
    queryKey: ['refunds', page],
    queryFn: async () =>
      (await api.get<PaginatedResponse<RefundSummary>>(`/refunds?page=${page}&limit=20`)).data,
    enabled: !id,
  });

  const detailQuery = useQuery({
    queryKey: ['refund', id],
    queryFn: async () => (await api.get<RefundSummary>(`/refunds/${id}`)).data,
    enabled: Boolean(id),
  });

  if (id) {
    return (
      <Layout>
        <div style={{ marginBottom: '16px' }}>
          <Link to="/refunds" className="btn btn-sm">
            <ArrowLeft size={13} aria-hidden="true" />
            <span>Back to refunds</span>
          </Link>
        </div>
        {detailQuery.isLoading && <LoadingState />}
        {detailQuery.error && (
          <ErrorState
            message={getErrorMessage(detailQuery.error)}
            onRetry={() => void detailQuery.refetch()}
          />
        )}
        {detailQuery.data && (
          <div className="panel" style={{ maxWidth: '640px' }}>
            <div className="panel-header">
              <h1>Refund {shortFolio('RFD', detailQuery.data.id)}</h1>
              {detailQuery.data.order && (
                <Link to={`/orders/${detailQuery.data.order.id}`} className="folio-id">
                  {detailQuery.data.order.displayId}
                </Link>
              )}
            </div>
            <div className="panel-body">
              <RefundTimeline refund={detailQuery.data} />
              {detailQuery.data.ticketId && (
                <div style={{ marginTop: '16px' }}>
                  <Link to={`/tickets/${detailQuery.data.ticketId}`} className="btn btn-sm">
                    View linked ticket
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Refunds</h1>
          <p className="text-muted" style={{ marginTop: '4px', fontSize: '12px' }}>
            Track refund status, simulated payment references, and review progress
          </p>
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
            <EmptyState message="No refunds yet" />
          ) : (
            <div className="ledger-table-wrap">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Refund ID</th>
                    <th>Order</th>
                    <th>Status</th>
                    <th>Payment Ref</th>
                    <th>Date</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {listQuery.data.data.map((r) => (
                    <tr key={r.id}>
                      <td data-label="Refund ID">
                        <Link to={`/refunds/${r.id}`} className="folio-id">
                          {shortFolio('RFD', r.id)}
                        </Link>
                      </td>
                      <td data-label="Order">{r.order?.displayId ?? '—'}</td>
                      <td data-label="Status">
                        <StatusBadge status={r.status} />
                      </td>
                      <td data-label="Payment Ref" className="tabular text-muted">
                        {r.paymentRef ?? '—'}
                      </td>
                      <td data-label="Date" className="tabular text-muted">
                        {formatDate(r.createdAt)}
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
