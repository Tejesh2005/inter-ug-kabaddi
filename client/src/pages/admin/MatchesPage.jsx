import { useCallback, useEffect, useState } from 'react';
import { matchApi, teamApi, tournamentApi } from '../../api/management';
import { Link } from 'react-router-dom';
import MatchForm from '../../components/admin/MatchForm';
import PageHeader from '../../components/admin/PageHeader';
import { EmptyState, LoadingState, RequestError } from '../../components/admin/RequestState';

const filters = ['all', 'live', 'upcoming', 'completed'];
const apiMessage = (error) => error.response?.data?.message ?? 'Check your connection and try again.';
const isEditable = (status) => ['scheduled', 'upcoming'].includes(status);
const formatDate = (value) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

export default function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [matchData, teamData, tournamentData] = await Promise.all([matchApi.list(filter), teamApi.list(), tournamentApi.list()]);
      setMatches(matchData); setTeams(teamData); setTournaments(tournamentData);
    } catch (requestError) { setError(apiMessage(requestError)); }
    finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const save = async (payload) => {
    setSaving(true); setError('');
    try {
      if (editing) await matchApi.update(editing._id, payload); else await matchApi.create(payload);
      setFormOpen(false); setEditing(null); await load();
    } catch (requestError) { setError(apiMessage(requestError)); }
    finally { setSaving(false); }
  };

  return (
    <section>
      <PageHeader eyebrow="FIXTURE MANAGEMENT" title="Matches" description="Schedule fixtures and keep upcoming and completed matches organized." action={<button className="primary-action header-action" type="button" onClick={() => { setEditing(null); setFormOpen(true); }}><i className="bi bi-calendar-plus" />New fixture</button>} />
      <div className="match-filters" role="group" aria-label="Filter matches">{filters.map((item) => <button className={filter === item ? 'active' : ''} type="button" key={item} onClick={() => setFilter(item)}>{item}</button>)}</div>
      {error && <RequestError message={error} onRetry={load} />}
      {formOpen && <MatchForm match={editing} teams={teams} tournaments={tournaments} onSave={save} onCancel={() => setFormOpen(false)} saving={saving} />}
      {loading ? <LoadingState /> : matches.length === 0 ? <EmptyState icon="bi-calendar3" title={`No ${filter === 'all' ? '' : `${filter} `}matches`} message="Fixtures matching this filter will appear here." /> : (
        <div className="fixture-list">{matches.map((match) => (
          <article className={`fixture-card fixture-${match.status}`} key={match._id}>
            <div className="fixture-meta"><span>Match {match.matchNumber} · {match.stage}</span><strong>{match.status === 'completed' ? 'FINAL' : match.status}</strong></div>
            <div className="fixture-teams">
              <div><span className="fixture-team-mark" style={{ '--team-color': match.teamA.primaryColor }}>{match.teamA.shortName.slice(0, 3)}</span><strong>{match.teamA.shortName}</strong>{['live', 'halftime', 'completed'].includes(match.status) && <b>{match.teamAScore}</b>}</div>
              <span className="fixture-vs">VS</span>
              <div><span className="fixture-team-mark" style={{ '--team-color': match.teamB.primaryColor }}>{match.teamB.shortName.slice(0, 3)}</span><strong>{match.teamB.shortName}</strong>{['live', 'halftime', 'completed'].includes(match.status) && <b>{match.teamBScore}</b>}</div>
            </div>
            <div className="fixture-footer"><span><i className="bi bi-calendar3" />{formatDate(match.scheduledDate)} · {match.scheduledTime}</span><span><i className="bi bi-geo-alt" />{match.venue}</span><div className="fixture-actions">{isEditable(match.status) && <><Link to={`/admin/matches/${match._id}/lineup`}><i className="bi bi-people" />Lineup</Link><button type="button" onClick={() => { setEditing(match); setFormOpen(true); }}><i className="bi bi-pencil" />Edit</button></>}<Link className="score-match-link" to={`/admin/matches/${match._id}/scoring`}><i className="bi bi-broadcast" />{isEditable(match.status) ? 'Start desk' : 'Scoring'}</Link><Link to={`/admin/matches/${match._id}/audit`}><i className="bi bi-clock-history" />Audit</Link></div></div>
          </article>
        ))}</div>
      )}
    </section>
  );
}
