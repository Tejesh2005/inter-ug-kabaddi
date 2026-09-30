import { useAuth } from '../../context/AuthContext';
import ScoringMatchPicker from '../../components/admin/ScoringMatchPicker';

export default function AdminDashboardPage() {
  const { admin } = useAuth();

  return (
    <section className="admin-welcome">
      <p className="eyebrow">SECURE SESSION ACTIVE</p>
      <h1>Welcome, {admin.name.split(' ')[0]}.</h1>
      <p>Your protected scorer workspace is ready. Select a match below to prepare or continue scoring.</p>
      <div className="access-card">
        <span><i className="bi bi-person-check" aria-hidden="true" />Signed in as</span>
        <strong>{admin.email}</strong>
        <small>{admin.role.replace('_', ' ')}</small>
      </div>
      <ScoringMatchPicker />
    </section>
  );
}
