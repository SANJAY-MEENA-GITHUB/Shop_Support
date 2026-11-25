import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, formatCurrency, formatDate, getErrorMessage } from '../../lib/api';
import { Order, OrderStatus, PaginatedResponse } from '../../lib/types';
import { Layout } from '../../components/Layout';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { Pagination } from '../../components/Pagination';

export function StaffOrders() {
  const [customerSearch, setCustomerSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['staff', 'orders', customerSearch, status, page],
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(customerSearch.trim() ? { customerSearch: customerSearch.trim() } : {}),
        ...(status ? { status } : {}),
      });
      return (await api.get<PaginatedResponse<Order>>(`/orders?${qs.toString()}`)).data;
    },
  });

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>All orders</h1>
          <p className="text-muted" style={{ marginTop: '4px', fontSize: '12px' }}>
            Read-only order ledger for customer support context
          </p>
        </div>
      </div>

      <div className="filters-bar">
        <div>
          <label className="label" htmlFor="staff-order-search">
            Search
          </label>
          <input
            id="staff-order-search"
            className="input"
            value={customerSearch}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              setPage(1);
            }}
            placeholder="ORD-1001, customer name or email"
          />
        </div>
        <div>
          <label className="label" htmlFor="staff-order-status">
            Status
          </label>
          <select
            id="staff-order-status"
            className="select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as OrderStatus | '');
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="PLACED">PLACED</option>
            <option value="SHIPPED">SHIPPED</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="RETURNED">RETURNED</option>
          </select>
        </div>
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />}

      {!isLoading && !error && data && (
        <>
          {data.data.length === 0 ? (
            <EmptyState message="No orders found." />
          ) : (
            <div className="ledger-table-wrap">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Delivery Date</th>
                    <th>Items</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((order) => (
                    <tr key={order.id}>
                      <td data-label="Order ID" className="folio-id">
                        {order.displayId}
                      </td>
                      <td data-label="Customer" className="text-muted">
                        {order.customer?.name ?? '—'}
                      </td>
                      <td data-label="Status">
                        <StatusBadge status={order.status} />
                      </td>
                      <td data-label="Delivery Date" className="tabular text-muted">
                        {formatDate(order.deliveryDate)}
                      </td>
                      <td data-label="Items">
                        {order.items.map((i) => `${i.name} ×${i.qty}`).join(', ')}
                      </td>
                      <td data-label="Total" className="num tabular">
                        {formatCurrency(order.totalAmount)}
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
