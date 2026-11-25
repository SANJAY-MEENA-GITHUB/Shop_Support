import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Terminal } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../lib/api';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isValid = email.includes('@') && password.length >= 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      navigate(user.role === 'SUPPORT' || user.role === 'ADMIN' ? '/staff' : '/');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div className="panel" style={{ width: '100%', maxWidth: '420px' }}>
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={16} aria-hidden="true" />
            <h1>Sign in</h1>
          </div>
          <span className="text-muted" style={{ fontSize: '11px' }}>
            SHOPSUPPORT
          </span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="panel-body"
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          {error && (
            <div className="banner-error" role="alert">
              {error}
            </div>
          )}

          <div>
            <label className="label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="priya@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!isValid || submitting}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <div
            style={{
              paddingTop: '12px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
            }}
          >
            <span className="text-muted">No account?</span>
            <Link to="/register">Create account</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
