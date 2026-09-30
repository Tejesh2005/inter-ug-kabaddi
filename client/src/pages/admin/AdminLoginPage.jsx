import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminLoginPage() {
  const { admin, loading, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  if (!loading && admin) return <Navigate to="/admin" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await login({ email: email.trim(), password });
      navigate(location.state?.from ?? '/admin', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Unable to sign in. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <Link className="brand-mark" to="/">
          <span className="brand-monogram" aria-hidden="true">IK</span>
          <span><strong>INTER UG</strong><small>KABADDI 2026</small></span>
        </Link>
        <div>
          <p className="eyebrow">SECURE TOURNAMENT CONTROL</p>
          <h1>Ready for<br /><span>the next raid.</span></h1>
          <p>Authorized scorers and tournament administrators only.</p>
        </div>
      </section>

      <section className="login-form-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card-heading">
            <span className="login-icon"><i className="bi bi-shield-lock" aria-hidden="true" /></span>
            <div><p className="eyebrow">ADMIN ACCESS</p><h2>Sign in</h2></div>
          </div>

          {error && <div className="login-alert" role="alert"><i className="bi bi-exclamation-circle" aria-hidden="true" />{error}</div>}

          <label className="form-label" htmlFor="admin-email">Email address</label>
          <input
            className="form-control admin-input"
            id="admin-email"
            type="email"
            inputMode="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@college.edu"
            required
          />

          <label className="form-label" htmlFor="admin-password">Password</label>
          <div className="password-field">
            <input
              className="form-control admin-input"
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
            </button>
          </div>

          <button className="login-submit" type="submit" disabled={submitting || loading}>
            {submitting ? <><span className="spinner-border spinner-border-sm" aria-hidden="true" />Signing in…</> : 'Sign in securely'}
          </button>
          <Link className="back-public" to="/"><i className="bi bi-chevron-left" aria-hidden="true" />Public website</Link>
        </form>
      </section>
    </main>
  );
}
