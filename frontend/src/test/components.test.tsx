import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { ChatThread } from '../components/ChatThread';
import { AuthProvider } from '../context/AuthContext';
import { Login } from '../pages/Login';

describe('Industrial UI smoke tests', () => {
  it('renders StatusBadge with accessible text label', () => {
    render(<StatusBadge status="PROCESSED" />);
    expect(screen.getByText('PROCESSED')).toBeInTheDocument();
  });

  it('renders EmptyState with exact message', () => {
    render(<EmptyState message="No open tickets" />);
    expect(screen.getByText('No open tickets')).toBeInTheDocument();
  });

  it('renders Login page with standard Sign in controls', () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <MemoryRouter>
            <Login />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders inline bold markdown in ChatThread without literal asterisks', () => {
    render(
      <ChatThread
        messages={[
          {
            id: 'msg-1',
            ticketId: 'tkt-1',
            senderId: null,
            senderType: 'AI',
            content: 'Eligible within **14 days** for `ORD-1001`.',
            createdAt: new Date().toISOString(),
          },
        ]}
      />
    );
    const strong = screen.getByText('14 days');
    expect(strong.tagName).toBe('STRONG');
    expect(screen.getByText('ORD-1001').tagName).toBe('CODE');
  });
});
