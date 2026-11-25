import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Terminal } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../lib/api';

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nameError = name.length > 0 && name.trim().length < 2 ? 'Name must be at least 2 characters' : null;
  const emailError = email.length > 0 && !email.includes('@') ? 'Enter a valid email address' : null;
  const passwordError =
    password.length > 0 && password.length < 8 ? 'Password must be at least 8 characters' : null;

  const isValid =
    name.trim().length >= 2 && email.includes('@') && password.length >= 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setError(null);
    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password);
      navigate('/');
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
            <h1>Create account</h1>
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
            <label className="label" htmlFor="reg-name">
              Full name
            </label>
            <input
              id="reg-name"
              className="input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Priya Sharma"
              required
            />
            {nameError && <div className="field-error">{nameError}</div>}
          </div>

          <div>
            <label className="label" htmlFor="reg-email">
              Email
            </label>
            <input
              id="reg-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            {emailError && <div className="field-error">{emailError}</div>}
          </div>

          <div>
            <label className="label" htmlFor="reg-password">
              Password (min 8 characters)
            </label>
            <input
              id="reg-password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            {passwordError && <div className="field-error">{passwordError}</div>}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!isValid || submitting}
          >
            {submitting ? 'Creating account…' : 'Create account'}
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
            <span className="text-muted">Already registered?</span>
            <Link to="/login">Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
