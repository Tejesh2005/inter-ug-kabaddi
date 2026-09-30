import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { playerApi, teamApi } from '../../api/management';
import PageHeader from '../../components/admin/PageHeader';
import PlayerForm from '../../components/admin/PlayerForm';
import { EmptyState, LoadingState, RequestError } from '../../components/admin/RequestState';

const apiMessage = (error) => error.response?.data?.message ?? 'Check your connection and try again.';

export default function TeamSquadPage() {
  const { teamId } = useParams();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setTeam(await teamApi.get(teamId)); }
    catch (requestError) { setError(apiMessage(requestError)); }
    finally { setLoading(false); }
  }, [teamId]);
  useEffect(() => { load(); }, [load]);

  const save = async (payload) => {
    setSaving(true); setError('');
    try {
      if (editing) await playerApi.update(editing._id, payload); else await playerApi.create(payload);
      setFormOpen(false); setEditing(null); await load();
    } catch (requestError) { setError(apiMessage(requestError)); }
    finally { setSaving(false); }
  };
  const remove = async (player) => {
    if (!window.confirm(`Remove ${player.name} from this squad?`)) return;
    try { await playerApi.remove(player._id); await load(); }
    catch (requestError) { setError(apiMessage(requestError)); }
  };

  if (loading) return <LoadingState />;
  if (!team) return <RequestError message={error || 'Team not found'} onRetry={load} />;

  return (
    <section>
      <Link className="section-back" to="/admin/teams"><i className="bi bi-chevron-left" />All teams</Link>
      <PageHeader eyebrow={`${team.shortName} · ${team.departmentOrUG}`} title={`${team.name} squad`} description={`${team.players.length} registered player${team.players.length === 1 ? '' : 's'}. Assign leadership and playing roles here.`} action={<button className="primary-action header-action" type="button" onClick={() => { setEditing(null); setFormOpen(true); }}><i className="bi bi-person-plus" />Add player</button>} />
      {error && <RequestError message={error} onRetry={load} />}
      {formOpen && <PlayerForm player={editing} teamId={teamId} onSave={save} onCancel={() => setFormOpen(false)} saving={saving} />}
      {team.players.length === 0 ? <EmptyState icon="bi-person-plus" title="Squad is empty" message="Add players before creating match lineups." /> : (
        <div className="player-grid">{team.players.map((player) => (
          <article className="player-management-card" key={player._id}>
            <div className="player-photo">{player.photo ? <img src={player.photo} alt="" /> : <i className="bi bi-person-fill" />}</div>
            <div className="player-card-body"><div className="jersey">#{player.jerseyNumber}</div><h2>{player.name}</h2><p>{player.role}{player.optionalPosition ? ` · ${player.optionalPosition}` : ''}</p><div className="leadership-tags">{player.isCaptain && <span>Captain</span>}{player.isViceCaptain && <span>Vice captain</span>}</div></div>
            <div className="player-actions"><button type="button" onClick={() => { setEditing(player); setFormOpen(true); }}><i className="bi bi-pencil" /><span>Edit</span></button><button className="danger-text" type="button" onClick={() => remove(player)}><i className="bi bi-trash3" /><span>Remove</span></button></div>
          </article>
        ))}</div>
      )}
    </section>
  );
}
