import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { publicApi } from '../../api/public';
import PublicScoreboard from '../../components/public/PublicScoreboard';
import { EmptyState, LoadingState, RequestError } from '../../components/admin/RequestState';
import { useMatchRealtime } from '../../hooks/useMatchRealtime';

const apiMessage = (error) => error.response?.data?.message ?? 'Check your connection and try again.';
const statChange = (stats, event) => {
  if (!event?.playerStatChanges?.length) return stats ?? [];
  return (stats ?? []).map((player) => {
    const change = event.playerStatChanges.find((item) => String(item.playerId) === String(player._id));
    if (!change) return player;
    const values = change.changes ?? {};
    return {
      ...player,
      totalPoints: player.totalPoints + (Number(values.totalPoints) || 0),
      raidPoints: player.raidPoints + (Number(values['raidStats.raidPoints']) || 0),
      bonusPoints: player.bonusPoints + (Number(values['raidStats.bonusPoints']) || 0),
      totalRaids: player.totalRaids + (Number(values['raidStats.totalRaids']) || 0),
      successfulRaids: player.successfulRaids + (Number(values['raidStats.successfulRaids']) || 0),
      tacklePoints: player.tacklePoints + (Number(values['defenceStats.tacklePoints']) || 0),
      tacklesAttempted: player.tacklesAttempted + (Number(values['defenceStats.tacklesAttempted']) || 0),
      successfulTackles: player.successfulTackles + (Number(values['defenceStats.successfulTackles']) || 0),
    };
  });
};

export default function LiveMatchPage() {
  const { matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try { const [matchData, eventData] = await Promise.all([publicApi.match(matchId), publicApi.events(matchId)]); setMatch(matchData); setEvents(eventData); setError(''); }
    catch (requestError) { setError(apiMessage(requestError)); }
    finally { setLoading(false); }
  }, [matchId]);
  useEffect(() => { load(); }, [load]);
  const handleState = useCallback(({ match: updatedMatch, event }) => {
    if (!updatedMatch) return;
    setMatch((current) => ({ ...updatedMatch, playerStats: statChange(current?.playerStats, event) }));
    if (event) setEvents((current) => [event, ...current.filter((item) => item._id !== event._id)].slice(0, 12));
  }, []);
  const connectionStatus = useMatchRealtime(matchId, { onState: handleState, onReconnect: load });
  if (loading) return <main className="public-page"><LoadingState /></main>;
  if (!match) return <main className="public-page"><RequestError message={error || 'Match not found'} onRetry={load} /></main>;
  const teamGroups = [['On court', match.teamA, match.teamAPlayersOnCourt, match.teamB, match.teamBPlayersOnCourt], ['Out', match.teamA, match.teamAOutPlayers, match.teamB, match.teamBOutPlayers]];
  const playerStats = (team) => match.playerStats?.filter((player) => String(player.teamId) === String(team._id)) ?? [];
  return <main className="public-page public-match-page"><Link className="section-back" to="/matches"><i className="bi bi-chevron-left" />All matches</Link><p className="public-kicker">{match.tournamentId?.name ?? 'INTER UG KABADDI'}</p><PublicScoreboard match={match} connectionStatus={connectionStatus} />
    <section className="public-section"><h1>Match feed</h1>{events.length ? <div className="event-list">{events.map((event) => <article key={event._id}><span>#{event.eventNumber}</span><div><strong>{event.description}</strong><small>{event.type.replaceAll('_', ' ')}</small></div><b>{event.teamAPointsChange || event.teamBPointsChange ? `${event.teamAPointsChange > 0 ? '+' : ''}${event.teamAPointsChange || event.teamBPointsChange}` : ''}</b></article>)}</div> : <EmptyState icon="bi-clock-history" title="No events yet" message="The first official event will appear here." />}</section>
    <section className="public-section"><h2>Players</h2>{teamGroups.map(([title, teamA, playersA, teamB, playersB]) => <div className="player-status-group" key={title}><h3>{title}</h3><div className="public-player-columns"><div><strong>{teamA.shortName}</strong>{playersA?.map((player) => <span key={player._id}>{player.name} <small>#{player.jerseyNumber}</small></span>)}</div><div><strong>{teamB.shortName}</strong>{playersB?.map((player) => <span key={player._id}>{player.name} <small>#{player.jerseyNumber}</small></span>)}</div></div></div>)}</section>
    <section className="public-section"><h2>Player stats</h2><p className="section-copy">Live, match-only statistics.</p><div className="match-stat-columns">{[match.teamA, match.teamB].map((team) => <div className="match-stat-team" key={team._id}><h3>{team.shortName}</h3>{playerStats(team).map((player) => <Link className="match-stat-row" to={`/players/${player._id}`} key={player._id}><span><strong>{player.name}</strong><small>#{player.jerseyNumber} · {player.totalRaids} raids · {player.tacklesAttempted} tackles</small></span><b>{player.totalPoints}<small>PTS</small></b><em>R {player.raidPoints} · T {player.tacklePoints} · B {player.bonusPoints}</em></Link>)}</div>)}</div></section>
  </main>;
}
