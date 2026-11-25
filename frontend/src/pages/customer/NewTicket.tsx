import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, formatCurrency, getErrorMessage } from '../../lib/api';
import { Order, PaginatedResponse, TicketCategory, TicketSummary } from '../../lib/types';
import { Layout } from '../../components/Layout';

const CATEGORIES: Array<{ value: TicketCategory; label: string }> = [
  { value: 'ORDER_ISSUE', label: 'Order issue' },
  { value: 'RETURN_REFUND', label: 'Return & refund' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'PRODUCT_QUESTION', label: 'Product question' },
  { value: 'OTHER', label: 'Other' },
];

export function NewTicket() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState<TicketCategory>('RETURN_REFUND');
  const [orderId, setOrderId] = useState(searchParams.get('orderId') ?? '');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  const ordersQuery = useQuery({
    queryKey: ['orders', 'select'],
    queryFn: async () => (await api.get<PaginatedResponse<Order>>('/orders?limit=50')).data,
  });

  const subjectError =
    subject.length > 0 && (subject.trim().length < 5 || subject.trim().length > 120)
      ? 'Subject must be 5–120 characters'
      : null;

  const descError =
    description.length > 0 &&
    (description.trim().length < 20 || description.trim().length > 2000)
      ? 'Description must be 20–2000 characters'
      : null;

  const isValid =
    subject.trim().length >= 5 &&
    subject.trim().length <= 120 &&
    description.trim().length >= 20 &&
    description.trim().length <= 2000;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<TicketSummary>('/tickets', {
        category,
        subject: subject.trim(),
        description: description.trim(),
        ...(orderId ? { orderId } : {}),
      });
      return res.data;
    },
    onSuccess: (ticket) => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      navigate(`/tickets/${ticket.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    mutation.mutate();
  };

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Create support ticket</h1>
          <p className="text-muted" style={{ marginTop: '4px', fontSize: '12px' }}>
            Submit an inquiry and continue in live AI + staff support chat
          </p>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: '680px' }}>
        <form
          onSubmit={handleSubmit}
          className="panel-body"
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          {mutation.isError && (
            <div className="banner-error" role="alert">
              {getErrorMessage(mutation.error)}
            </div>
          )}

          <div>
            <label className="label" htmlFor="ticket-category">
              Category
            </label>
            <select
              id="ticket-category"
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="ticket-order">
              Related order (optional)
            </label>
            <select
              id="ticket-order"
              className="select"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            >
              <option value="">None / General inquiry</option>
              {(ordersQuery.data?.data ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.displayId} — {o.status} ({formatCurrency(o.totalAmount)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="ticket-subject">
              Subject (5–120 characters)
            </label>
            <input
              id="ticket-subject"
              className="input"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Issue with delivered item"
              required
            />
            {subjectError && <div className="field-error">{subjectError}</div>}
          </div>

          <div>
            <label className="label" htmlFor="ticket-description">
              Description (20–2000 characters)
            </label>
            <textarea
              id="ticket-description"
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain what happened and how we can help..."
              required
            />
            {descError && <div className="field-error">{descError}</div>}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn"
              onClick={() => navigate(-1)}
              disabled={mutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!isValid || mutation.isPending}
            >
              {mutation.isPending ? 'Creating…' : 'Create ticket'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
