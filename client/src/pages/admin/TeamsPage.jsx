import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { teamApi } from '../../api/management';
import PageHeader from '../../components/admin/PageHeader';
import { EmptyState, LoadingState, RequestError } from '../../components/admin/RequestState';
import TeamForm from '../../components/admin/TeamForm';

const apiMessage = (error) => error.response?.data?.message ?? 'Check your connection and try again.';

export default function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setTeams(await teamApi.list()); }
    catch (requestError) { setError(apiMessage(requestError)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (team) => { setEditing(team); setFormOpen(true); };
  const save = async (payload) => {
    setSaving(true); setError('');
    try {
      if (editing) await teamApi.update(editing._id, payload); else await teamApi.create(payload);
      setFormOpen(false); setEditing(null); await load();
    } catch (requestError) { setError(apiMessage(requestError)); }
    finally { setSaving(false); }
  };
  const remove = async (team) => {
    if (!window.confirm(`Delete ${team.name}? The team must have no registered players.`)) return;
    try { await teamApi.remove(team._id); await load(); }
    catch (requestError) { setError(apiMessage(requestError)); }
  };

  return (
    <section>
      <PageHeader eyebrow="TEAM MANAGEMENT" title="Teams" description="Create participating UG or department teams and manage their squads." action={<button className="primary-action header-action" type="button" onClick={openCreate}><i className="bi bi-plus-lg" />New team</button>} />
      {error && <RequestError message={error} onRetry={load} />}
      {formOpen && <TeamForm team={editing} onSave={save} onCancel={() => setFormOpen(false)} saving={saving} />}
      {loading ? <LoadingState /> : teams.length === 0 ? <EmptyState icon="bi-people" title="No teams yet" message="Create the first team to begin registering players." /> : (
        <div className="team-grid">{teams.map((team) => (
          <article className="team-management-card" key={team._id}>
            <div className="team-identity">
              <div className="team-badge" style={{ '--team-primary': team.primaryColor, '--team-secondary': team.secondaryColor }}>{team.logo ? <img src={team.logo} alt="" /> : team.shortName.slice(0, 3)}</div>
              <div><span className={`status-tag ${team.status}`}>{team.status}</span><h2>{team.name}</h2><p>{team.departmentOrUG} · {team.shortName}</p></div>
            </div>
            <div className="team-card-actions"><Link to={`/admin/teams/${team._id}`}>Manage squad</Link><button type="button" onClick={() => openEdit(team)} aria-label={`Edit ${team.name}`}><i className="bi bi-pencil" /></button><button className="danger-icon" type="button" onClick={() => remove(team)} aria-label={`Delete ${team.name}`}><i className="bi bi-trash3" /></button></div>
          </article>
        ))}</div>
      )}
    </section>
  );
}
