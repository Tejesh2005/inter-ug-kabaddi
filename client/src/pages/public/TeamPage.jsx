import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { publicApi } from '../../api/public';
import MatchCard from '../../components/public/MatchCard';
import { EmptyState, LoadingState, RequestError } from '../../components/admin/RequestState';

export default function TeamPage() {
  const { teamId } = useParams(); const [data, setData] = useState(null); const [error, setError] = useState('');
  const load = useCallback(async () => { try { setData(await publicApi.team(teamId)); setError(''); } catch { setError('Team details could not be loaded.'); } }, [teamId]); useEffect(() => { load(); }, [load]);
  if (!data && !error) return <main className="public-page"><LoadingState /></main>; if (!data) return <main className="public-page"><RequestError message={error} onRetry={load} /></main>;
  const { team } = data; return <main className="public-page"><section className="profile-hero"><span className="team-swatch" style={{ background: team.primaryColor }}>{team.shortName.slice(0, 2)}</span><div><p className="public-kicker">{team.departmentOrUG}</p><h1>{team.name}</h1><p>{team.wins} wins · {team.losses} losses · {team.leaguePoints} points</p></div></section><section className="public-section"><h2>Squad</h2><div className="squad-grid">{team.players.map((player) => <Link to={`/players/${player._id}`} key={player._id}><span>#{player.jerseyNumber}</span><strong>{player.name}</strong><small>{player.role}{player.isCaptain ? ' · C' : player.isViceCaptain ? ' · VC' : ''}</small></Link>)}</div></section><section className="public-section"><h2>Recent matches</h2>{data.recentMatches.length ? <div className="public-match-list">{data.recentMatches.map((match) => <MatchCard match={match} key={match._id} />)}</div> : <EmptyState title="No completed matches" message="Results will appear here." />}</section><section className="public-section"><h2>Upcoming</h2>{data.upcomingMatches.length ? <div className="public-match-list">{data.upcomingMatches.map((match) => <MatchCard match={match} key={match._id} />)}</div> : <EmptyState title="No upcoming fixtures" message="Future fixtures will appear here." />}</section></main>;
}
