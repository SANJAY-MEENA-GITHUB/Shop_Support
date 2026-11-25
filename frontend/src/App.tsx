import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { LoadingState } from './components/LoadingState';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/customer/Dashboard';
import { Orders } from './pages/customer/Orders';
import { OrderDetail } from './pages/customer/OrderDetail';
import { NewTicket } from './pages/customer/NewTicket';
import { Tickets } from './pages/customer/Tickets';
import { TicketDetail } from './pages/customer/TicketDetail';
import { Refunds } from './pages/customer/Refunds';
import { StaffDashboard } from './pages/staff/StaffDashboard';
import { StaffTickets } from './pages/staff/StaffTickets';
import { StaffTicketDetail } from './pages/staff/StaffTicketDetail';
import { Escalations } from './pages/staff/Escalations';
import { StaffRefunds } from './pages/staff/StaffRefunds';
import { StaffOrders } from './pages/staff/StaffOrders';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
    },
  },
});

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="main-content">
        <LoadingState />
      </div>
    );
  }
  if (user) {
    return <Navigate to={user.role === 'CUSTOMER' ? '/' : '/staff'} replace />;
  }
  return <>{children}</>;
}

function CustomerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="main-content">
        <LoadingState />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'CUSTOMER') return <Navigate to="/staff" replace />;
  return <>{children}</>;
}

function StaffRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="main-content">
        <LoadingState />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'CUSTOMER') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <Register />
          </PublicOnlyRoute>
        }
      />

      {/* Customer routes */}
      <Route
        path="/"
        element={
          <CustomerRoute>
            <Dashboard />
          </CustomerRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <CustomerRoute>
            <Orders />
          </CustomerRoute>
        }
      />
      <Route
        path="/orders/:id"
        element={
          <CustomerRoute>
            <OrderDetail />
          </CustomerRoute>
        }
      />
      <Route
        path="/tickets/new"
        element={
          <CustomerRoute>
            <NewTicket />
          </CustomerRoute>
        }
      />
      <Route
        path="/tickets"
        element={
          <CustomerRoute>
            <Tickets />
          </CustomerRoute>
        }
      />
      <Route
        path="/tickets/:id"
        element={
          <CustomerRoute>
            <TicketDetail />
          </CustomerRoute>
        }
      />
      <Route
        path="/refunds"
        element={
          <CustomerRoute>
            <Refunds />
          </CustomerRoute>
        }
      />
      <Route
        path="/refunds/:id"
        element={
          <CustomerRoute>
            <Refunds />
          </CustomerRoute>
        }
      />

      {/* Staff / Admin routes */}
      <Route
        path="/staff"
        element={
          <StaffRoute>
            <StaffDashboard />
          </StaffRoute>
        }
      />
      <Route
        path="/staff/tickets"
        element={
          <StaffRoute>
            <StaffTickets />
          </StaffRoute>
        }
      />
      <Route
        path="/staff/tickets/:id"
        element={
          <StaffRoute>
            <StaffTicketDetail />
          </StaffRoute>
        }
      />
      <Route
        path="/staff/escalations"
        element={
          <StaffRoute>
            <Escalations />
          </StaffRoute>
        }
      />
      <Route
        path="/staff/escalations/:id"
        element={
          <StaffRoute>
            <Escalations />
          </StaffRoute>
        }
      />
      <Route
        path="/staff/refunds"
        element={
          <StaffRoute>
            <StaffRefunds />
          </StaffRoute>
        }
      />
      <Route
        path="/staff/orders"
        element={
          <StaffRoute>
            <StaffOrders />
          </StaffRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
