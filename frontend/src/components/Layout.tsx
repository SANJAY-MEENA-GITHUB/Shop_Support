import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Terminal } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isStaff = user?.role === 'SUPPORT' || user?.role === 'ADMIN';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <NavLink to={isStaff ? '/staff' : '/'} className="brand">
            <Terminal size={16} aria-hidden="true" />
            <span>ShopSupport</span>
          </NavLink>

          <nav className="nav-links" aria-label="Main navigation">
            {isStaff ? (
              <>
                <NavLink to="/staff" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Dashboard
                </NavLink>
                <NavLink to="/staff/tickets" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Tickets
                </NavLink>
                <NavLink to="/staff/escalations" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Escalations
                </NavLink>
                <NavLink to="/staff/refunds" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Refunds
                </NavLink>
                <NavLink to="/staff/orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Orders
                </NavLink>
              </>
            ) : (
              <>
                <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Dashboard
                </NavLink>
                <NavLink to="/orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Orders
                </NavLink>
                <NavLink to="/tickets" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Tickets
                </NavLink>
                <NavLink to="/refunds" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Refunds
                </NavLink>
                <NavLink to="/tickets/new" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  New ticket
                </NavLink>
              </>
            )}
          </nav>

          {user && (
            <div className="user-bar">
              <span className="text-muted">
                {user.name} <span className="badge badge-muted">{user.role}</span>
              </span>
              <button type="button" className="btn btn-sm" onClick={handleLogout}>
                <LogOut size={13} aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="main-content">{children}</main>
    </div>
  );
}
