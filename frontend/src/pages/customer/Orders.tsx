import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, formatCurrency, formatDate, getErrorMessage } from '../../lib/api';
import { Order, PaginatedResponse } from '../../lib/types';
import { Layout } from '../../components/Layout';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { Pagination } from '../../components/Pagination';

export function Orders() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['orders', page],
    queryFn: async () =>
      (await api.get<PaginatedResponse<Order>>(`/orders?page=${page}&limit=20`)).data,
  });

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>My orders</h1>
          <p className="text-muted" style={{ marginTop: '4px', fontSize: '12px' }}>
            Select an order to view items, return eligibility, or request a refund
          </p>
        </div>
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />}

      {!isLoading && !error && data && (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No orders placed yet." />
          ) : (
            <div className="ledger-table-wrap">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Status</th>
                    <th>Delivery Date</th>
                    <th>Items</th>
                    <th className="num">Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((order) => (
                    <tr key={order.id}>
                      <td data-label="Order ID">
                        <Link to={`/orders/${order.id}`} className="folio-id">
                          {order.displayId}
                        </Link>
                      </td>
                      <td data-label="Status">
                        <StatusBadge status={order.status} />
                      </td>
                      <td data-label="Delivery Date" className="tabular text-muted">
                        {formatDate(order.deliveryDate)}
                      </td>
                      <td data-label="Items">
                        {order.items.map((i) => `${i.name} (${i.category}) ×${i.qty}`).join(', ')}
                      </td>
                      <td data-label="Amount" className="num tabular">
                        {formatCurrency(order.totalAmount)}
                      </td>
                      <td data-label="Action">
                        <Link to={`/orders/${order.id}`} className="btn btn-sm">
                          Inspect
                        </Link>
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
