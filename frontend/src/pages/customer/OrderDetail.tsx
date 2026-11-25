import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api, formatCurrency, formatDate, getErrorMessage } from '../../lib/api';
import { Order, OrderEligibility } from '../../lib/types';
import { Layout } from '../../components/Layout';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { StatusBadge } from '../../components/StatusBadge';
import { RefundModal } from '../../components/RefundModal';
import { RefundTimeline } from '../../components/RefundTimeline';

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [showRefundModal, setShowRefundModal] = useState(false);

  const orderQuery = useQuery({
    queryKey: ['order', id],
    queryFn: async () => (await api.get<Order>(`/orders/${id}`)).data,
    enabled: Boolean(id),
  });

  const eligibilityQuery = useQuery({
    queryKey: ['order', id, 'eligibility'],
    queryFn: async () => (await api.get<OrderEligibility>(`/orders/${id}/eligibility`)).data,
    enabled: Boolean(id),
  });

  const order = orderQuery.data;
  const eligibility = eligibilityQuery.data;

  return (
    <Layout>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/orders" className="btn btn-sm">
          <ArrowLeft size={13} aria-hidden="true" />
          <span>Back to orders</span>
        </Link>
      </div>

      {orderQuery.isLoading && <LoadingState />}
      {orderQuery.error && (
        <ErrorState
          message={getErrorMessage(orderQuery.error)}
          onRetry={() => void orderQuery.refetch()}
        />
      )}

      {order && (
        <>
          <div className="page-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h1>{order.displayId}</h1>
                <StatusBadge status={order.status} />
              </div>
              <p className="text-muted tabular" style={{ marginTop: '6px', fontSize: '12px' }}>
                Placed {formatDate(order.createdAt)} · Delivered {formatDate(order.deliveryDate)} · Total{' '}
                {formatCurrency(order.totalAmount)}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Link to={`/tickets/new?orderId=${order.id}`} className="btn">
                Create ticket
              </Link>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowRefundModal(true)}
                disabled={eligibility ? !eligibility.eligible : false}
              >
                Request refund
              </button>
            </div>
          </div>

          <div className="detail-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <section className="panel">
                <div className="panel-header">
                  <h2>Line items</h2>
                </div>
                <div className="ledger-table-wrap" style={{ border: 'none' }}>
                  <table className="ledger-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Category</th>
                        <th className="num">Qty</th>
                        <th className="num">Unit Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item, idx) => (
                        <tr key={idx}>
                          <td data-label="Item">{item.name}</td>
                          <td data-label="Category" className="text-muted">
                            {item.category}
                          </td>
                          <td data-label="Qty" className="num tabular">
                            {item.qty}
                          </td>
                          <td data-label="Unit Price" className="num tabular">
                            {formatCurrency(item.unitPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <h2>Refund history</h2>
                </div>
                <div className="panel-body">
                  {!order.refunds || order.refunds.length === 0 ? (
                    <p className="text-muted">No refund requests for this order.</p>
                  ) : (
                    order.refunds.map((r) => <RefundTimeline key={r.id} refund={r} />)
                  )}
                </div>
              </section>
            </div>

            <aside className="panel">
              <div className="panel-header">
                <h2>Return eligibility</h2>
              </div>
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                {eligibilityQuery.isLoading && <span className="text-muted">Checking…</span>}
                {eligibility && (
                  <>
                    <div>
                      Status:{' '}
                      <span className={eligibility.eligible ? 'text-signal' : 'text-red'}>
                        {eligibility.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
                      </span>
                    </div>
                    <div className="tabular">
                      Return window: {eligibility.returnWindowDays} days
                    </div>
                    <div className="tabular">
                      Days since delivery:{' '}
                      {eligibility.daysSinceDelivery !== null
                        ? `${eligibility.daysSinceDelivery} days`
                        : 'Not delivered'}
                    </div>
                    <div className="tabular">
                      Refundable balance: {formatCurrency(eligibility.refundableAmount)}
                    </div>
                    {eligibility.reasons.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                        <div className="label">Policy reasons</div>
                        {eligibility.reasons.map((reason, idx) => (
                          <div key={idx} className="text-red" style={{ fontSize: '12px' }}>
                            • {reason}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </aside>
          </div>

          {showRefundModal && (
            <RefundModal
              orderId={order.id}
              orderDisplayId={order.displayId}
              maxAmount={eligibility?.refundableAmount ?? order.totalAmount}
              onClose={() => setShowRefundModal(false)}
              onSuccess={() => {
                void orderQuery.refetch();
                void eligibilityQuery.refetch();
              }}
            />
          )}
        </>
      )}
    </Layout>
  );
}
