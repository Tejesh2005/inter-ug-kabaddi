import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { auditApi, matchApi } from '../../api/management';
import { EmptyState, LoadingState, RequestError } from '../../components/admin/RequestState';

const apiMessage = (error) => error.response?.data?.message ?? 'Check your connection and try again.';
const formatType = (type) => type.replaceAll('_', ' ');
const formatTime = (value) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function MatchAuditPage() {
  const { matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [matchData, eventData] = await Promise.all([matchApi.get(matchId), auditApi.list(matchId)]);
      setMatch(matchData); setEvents(eventData);
    } catch (requestError) { setError(apiMessage(requestError)); }
    finally { setLoading(false); }
  }, [matchId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;
  if (!match) return <RequestError message={error || 'Match not found'} onRetry={load} />;
  return (
    <section className="audit-page">
      <Link className="section-back" to={`/admin/matches/${matchId}/scoring`}><i className="bi bi-chevron-left" />Scoring console</Link>
      <header className="audit-header"><div><p>Match {match.matchNumber}</p><h1>Audit history</h1><span>{match.teamA.shortName} {match.teamAScore} - {match.teamBScore} {match.teamB.shortName}</span></div><button type="button" onClick={load}><i className="bi bi-arrow-clockwise" />Refresh</button></header>
      {error && <RequestError message={error} onRetry={load} />}
      {events.length === 0 ? <EmptyState icon="bi-clock-history" title="No match events" message="Scoring actions will appear here in event order." /> : <div className="audit-timeline">{events.map((event) => <article className={`audit-event ${event.isUndone ? 'undone' : ''}`} key={event._id}><div className="audit-event-number">#{event.eventNumber}</div><div className="audit-event-main"><div><strong>{formatType(event.type)}</strong>{event.isUndone && <span>UNDONE</span>}</div><h2>{event.description}</h2><p>{formatTime(event.timestamp)} by {event.createdBy?.name ?? 'Administrator'}</p><div className="audit-score"><span>Before <b>{event.previousState?.teamAScore ?? '?'} - {event.previousState?.teamBScore ?? '?'}</b></span><i className="bi bi-arrow-right" /><span>After <b>{event.teamAScoreAfter} - {event.teamBScoreAfter}</b></span></div>{event.isUndone && <small>Undone by {event.undoneBy?.name ?? 'Administrator'}{event.undoneAt ? ` on ${formatTime(event.undoneAt)}` : ''}</small>}</div></article>)}</div>}
    </section>
  );
}
