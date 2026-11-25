import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MessageSquarePlus, Send } from 'lucide-react';
import { api, formatCurrency, formatDate, getErrorMessage, shortFolio } from '../../lib/api';
import { ChatResponse, Order, PaginatedResponse, RefundSummary, TicketSummary } from '../../lib/types';
import { Layout } from '../../components/Layout';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge, PriorityBadge } from '../../components/StatusBadge';

export function Dashboard() {
  const navigate = useNavigate();
  const [quickPrompt, setQuickPrompt] = useState('');

  const ordersQuery = useQuery({
    queryKey: ['orders', 'dashboard'],
    queryFn: async () => (await api.get<PaginatedResponse<Order>>('/orders?limit=5')).data,
  });

  const ticketsQuery = useQuery({
    queryKey: ['tickets', 'dashboard'],
    queryFn: async () => (await api.get<PaginatedResponse<TicketSummary>>('/tickets?limit=5')).data,
  });

  const refundsQuery = useQuery({
    queryKey: ['refunds', 'dashboard'],
    queryFn: async () => (await api.get<PaginatedResponse<RefundSummary>>('/refunds?limit=5')).data,
  });

  const startChatMutation = useMutation({
    mutationFn: async (message: string) =>
      (await api.post<ChatResponse>('/chat', { message })).data,
    onSuccess: (data) => {
      navigate(`/tickets/${data.ticketId}`);
    },
  });

  const isLoading = ordersQuery.isLoading || ticketsQuery.isLoading || refundsQuery.isLoading;
  const firstError = ordersQuery.error || ticketsQuery.error || refundsQuery.error;

  const orders = ordersQuery.data?.data ?? [];
  const tickets = ticketsQuery.data?.data ?? [];
  const refunds = refundsQuery.data?.data ?? [];

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Customer dashboard</h1>
          <p className="text-muted" style={{ marginTop: '4px', fontSize: '12px' }}>
            Orders, support tickets, and refund status ledger
          </p>
        </div>
        <Link to="/tickets/new" className="btn btn-primary">
          <MessageSquarePlus size={14} aria-hidden="true" />
          <span>Create ticket</span>
        </Link>
      </div>

      {/* Quick AI chat starter */}
      <div className="panel" style={{ marginBottom: '24px' }}>
        <div className="panel-header">
          <h2>Ask AI Support Agent</h2>
          <span className="text-muted" style={{ fontSize: '11px' }}>
            Starts a tracked ticket thread
          </span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!quickPrompt.trim()) return;
            startChatMutation.mutate(quickPrompt.trim());
          }}
          className="panel-body"
          style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}
        >
          <input
            className="input"
            style={{ flex: '1 1 260px' }}
            value={quickPrompt}
            onChange={(e) => setQuickPrompt(e.target.value)}
            placeholder="Ask about an order, return policy, or request a refund (e.g. ORD-1001)..."
            aria-label="Ask AI Support Agent"
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!quickPrompt.trim() || startChatMutation.isPending}
          >
            <Send size={14} aria-hidden="true" />
            <span>{startChatMutation.isPending ? 'Starting…' : 'Start chat'}</span>
          </button>
          {startChatMutation.isError && (
            <div className="banner-error" style={{ width: '100%' }}>
              {getErrorMessage(startChatMutation.error)}
            </div>
          )}
        </form>
      </div>

      {isLoading && <LoadingState />}
      {firstError && (
        <ErrorState
          message={getErrorMessage(firstError)}
          onRetry={() => {
            void ordersQuery.refetch();
            void ticketsQuery.refetch();
            void refundsQuery.refetch();
          }}
        />
      )}

      {!isLoading && !firstError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Recent Orders */}
          <section>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
              }}
            >
              <h2>Recent orders</h2>
              <Link to="/orders" style={{ fontSize: '12px' }}>
                View all ({ordersQuery.data?.total ?? 0})
              </Link>
            </div>
            {orders.length === 0 ? (
              <EmptyState message="No orders found on this account." />
            ) : (
              <div className="ledger-table-wrap">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Status</th>
                      <th>Delivered</th>
                      <th>Items</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td data-label="Order ID">
                          <Link to={`/orders/${order.id}`} className="folio-id">
                            {order.displayId}
                          </Link>
                        </td>
                        <td data-label="Status">
                          <StatusBadge status={order.status} />
                        </td>
                        <td data-label="Delivered" className="tabular text-muted">
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
          </section>

          {/* Open Tickets */}
          <section>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
              }}
            >
              <h2>Support tickets</h2>
              <Link to="/tickets" style={{ fontSize: '12px' }}>
                View all ({ticketsQuery.data?.total ?? 0})
              </Link>
            </div>
            {tickets.length === 0 ? (
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
                      <th>Order</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((ticket) => (
                      <tr key={ticket.id}>
                        <td data-label="Ticket">
                          <Link to={`/tickets/${ticket.id}`} className="folio-id">
                            {shortFolio('TKT', ticket.id)}
                          </Link>
                        </td>
                        <td data-label="Subject">
                          <Link to={`/tickets/${ticket.id}`}>{ticket.subject}</Link>
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
          </section>

          {/* Active Refunds */}
          <section>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
              }}
            >
              <h2>Refund ledger</h2>
              <Link to="/refunds" style={{ fontSize: '12px' }}>
                View all ({refundsQuery.data?.total ?? 0})
              </Link>
            </div>
            {refunds.length === 0 ? (
              <EmptyState message="No refunds yet" />
            ) : (
              <div className="ledger-table-wrap">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>Refund</th>
                      <th>Order</th>
                      <th>Status</th>
                      <th>Payment Ref</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refunds.map((refund) => (
                      <tr key={refund.id}>
                        <td data-label="Refund">
                          <Link to={`/refunds/${refund.id}`} className="folio-id">
                            {shortFolio('RFD', refund.id)}
                          </Link>
                        </td>
                        <td data-label="Order">{refund.order?.displayId ?? '—'}</td>
                        <td data-label="Status">
                          <StatusBadge status={refund.status} />
                        </td>
                        <td data-label="Payment Ref" className="text-muted tabular">
                          {refund.paymentRef ?? '—'}
                        </td>
                        <td data-label="Amount" className="num tabular">
                          {formatCurrency(refund.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </Layout>
  );
}
