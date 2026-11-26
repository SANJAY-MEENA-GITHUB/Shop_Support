import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, formatCurrency, formatDate, getErrorMessage, shortFolio } from '../../lib/api';
import { PaginatedResponse, RefundStatus, RefundSummary } from '../../lib/types';
import { Layout } from '../../components/Layout';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { Pagination } from '../../components/Pagination';

export function StaffRefunds() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RefundStatus | ''>('');
  const [orderSearch, setOrderSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['staff', 'refunds', status, orderSearch, page],
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(status ? { status } : {}),
        ...(orderSearch.trim() ? { orderSearch: orderSearch.trim() } : {}),
      });
      return (await api.get<PaginatedResponse<RefundSummary>>(`/refunds?${qs.toString()}`)).data;
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      refundId,
      decision,
    }: {
      refundId: string;
      decision: 'APPROVED' | 'REJECTED';
    }) => api.patch(`/refunds/${refundId}/review`, { decision }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff', 'refunds'] });
      void queryClient.invalidateQueries({ queryKey: ['staff', 'count'] });
    },
  });

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Refund review queue</h1>
          <p className="text-muted" style={{ marginTop: '4px', fontSize: '12px' }}>
            Inspect all refund transactions and approve or reject escalated requests
          </p>
        </div>
      </div>

      <div className="filters-bar">
        <div>
          <label className="label" htmlFor="refund-search">
            Order / Customer
          </label>
          <input
            id="refund-search"
            className="input"
            value={orderSearch}
            onChange={(e) => {
              setOrderSearch(e.target.value);
              setPage(1);
            }}
            placeholder="ORD-1003 or customer name"
          />
        </div>
        <div>
          <label className="label" htmlFor="refund-status">
            Status
          </label>
          <select
            id="refund-status"
            className="select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as RefundStatus | '');
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="ESCALATED">ESCALATED</option>
            <option value="PENDING_REVIEW">PENDING_REVIEW</option>
            <option value="APPROVED">APPROVED</option>
            <option value="PROCESSED">PROCESSED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="FAILED">FAILED</option>
          </select>
        </div>
      </div>

      {reviewMutation.isError && (
        <div className="banner-error" style={{ marginBottom: '14px' }}>
          {getErrorMessage(reviewMutation.error)}
        </div>
      )}

      {isLoading && <LoadingState />}
      {error && <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />}

      {!isLoading && !error && data && (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No refunds match the current filters." />
          ) : (
            <div className="ledger-table-wrap">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Refund</th>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th className="num">Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((r) => {
                    const reviewable =
                      r.status === 'ESCALATED' ||
                      r.status === 'PENDING_REVIEW' ||
                      r.status === 'FAILED';
                    return (
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
                        <td data-label="Date" className="tabular text-muted">
                          {formatDate(r.createdAt)}
                        </td>
                        <td data-label="Amount" className="num tabular">
                          {formatCurrency(r.amount)}
                        </td>
                        <td data-label="Actions">
                          {reviewable ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={reviewMutation.isPending}
                                onClick={() =>
                                  reviewMutation.mutate({ refundId: r.id, decision: 'APPROVED' })
                                }
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                disabled={reviewMutation.isPending}
                                onClick={() =>
                                  reviewMutation.mutate({ refundId: r.id, decision: 'REJECTED' })
                                }
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '12px' }}>
                              {r.paymentRef ?? 'Reviewed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
