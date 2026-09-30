import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ allowedRoles }) {
  const { admin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="auth-loading" aria-live="polite">
        <span className="spinner-border" aria-hidden="true" />
        <p>Checking secure session…</p>
      </main>
    );
  }

  if (!admin) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  if (allowedRoles && !allowedRoles.includes(admin.role)) return <Navigate to="/admin" replace />;
  return <Outlet />;
}
