import { Link } from 'react-router-dom';

export default function AppHeader() {
  return (
    <header className="app-header">
      <div className="container-fluid app-container d-flex align-items-center justify-content-between">
        <a className="brand-mark" href="/" aria-label="Inter UG Kabaddi home">
          <span className="brand-monogram" aria-hidden="true">IK</span>
          <span>
            <strong>INTER UG</strong>
            <small>KABADDI 2026</small>
          </span>
        </a>
        <Link className="admin-entry" to="/admin/login"><i className="bi bi-lock" aria-hidden="true" />Admin</Link>
      </div>
    </header>
  );
}
