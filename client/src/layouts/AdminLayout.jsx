import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navigation = [
  ['bi-grid-1x2-fill', 'Dashboard', '/admin', false, null],
  ['bi-trophy', 'Tournament', '/admin/tournament', false, 'SUPER_ADMIN'],
  ['bi-people', 'Teams', '/admin/teams', false, 'SUPER_ADMIN'],
  ['bi-calendar-event', 'Matches', '/admin/matches', false, 'SUPER_ADMIN'],
];

export default function AdminLayout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <NavLink className="brand-mark" to="/" aria-label="Return to public website">
          <span className="brand-monogram" aria-hidden="true">IK</span>
          <span><strong>SCORER DESK</strong><small>{admin.role.replace('_', ' ')}</small></span>
        </NavLink>
        <button className="admin-signout" type="button" onClick={handleLogout} aria-label="Sign out">
          <i className="bi bi-box-arrow-right" aria-hidden="true" /><span>Sign out</span>
        </button>
      </header>

      <div className="admin-frame">
        <nav className="admin-navigation" aria-label="Admin navigation">
          {navigation.filter(([, , , , role]) => !role || role === admin.role).map(([icon, label, to, disabled]) => disabled ? (
            <span className="admin-nav-link disabled" key={label} aria-disabled="true">
              <i className={`bi ${icon}`} aria-hidden="true" /><span>{label}</span>
            </span>
          ) : (
            <NavLink className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`} to={to} end key={label}>
              <i className={`bi ${icon}`} aria-hidden="true" /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <main className="admin-content"><Outlet /></main>
      </div>
    </div>
  );
}
