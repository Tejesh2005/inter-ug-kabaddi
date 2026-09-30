import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicApi } from '../api/public';
import MatchCard from '../components/public/MatchCard';
import PublicScoreboard from '../components/public/PublicScoreboard';
import { EmptyState, LoadingState, RequestError } from '../components/admin/RequestState';
import { useMatchRealtime } from '../hooks/useMatchRealtime';

export default function HomePage() {
  const [data, setData] = useState(null); const [error, setError] = useState('');
  const load = useCallback(async () => { try { setData(await publicApi.home()); setError(''); } catch { setError('The tournament feed is unavailable right now.'); } }, []);
  useEffect(() => { load(); }, [load]);
  const applyLiveState = useCallback(({ match }) => setData((current) => current?.liveMatch ? { ...current, liveMatch: match } : current), []);
  const connectionStatus = useMatchRealtime(data?.liveMatch?._id, { onState: applyLiveState, onReconnect: load });
  if (!data && !error) return <main className="public-page"><LoadingState /></main>;
  if (!data) return <main className="public-page"><RequestError message={error} onRetry={load} /></main>;
  return <main className="public-page public-home"><p className="public-kicker">{data.tournament?.name ?? 'INTER UG KABADDI'}</p><h1>Championship live.</h1>
    {data.liveMatch ? <section className="home-live"><div className="section-heading"><h2>Live now</h2><Link to={`/match/${data.liveMatch._id}`}>Open match <i className="bi bi-arrow-up-right" /></Link></div><PublicScoreboard match={data.liveMatch} connectionStatus={connectionStatus} /></section> : <section className="public-empty-hero"><i className="bi bi-broadcast-pin" /><h2>No match is live</h2><p>The next match will appear here as soon as the whistle goes.</p></section>}
    <section className="public-section"><div className="section-heading"><h2>Upcoming</h2><Link to="/matches">All fixtures</Link></div>{data.upcomingMatches.length ? <div className="public-match-list">{data.upcomingMatches.map((match) => <MatchCard match={match} key={match._id} />)}</div> : <EmptyState icon="bi-calendar3" title="Fixtures are coming" message="Check back after the schedule is published." />}</section>
    <section className="public-section"><div className="section-heading"><h2>Recent results</h2><Link to="/standings">Standings</Link></div>{data.recentResults.length ? <div className="public-match-list">{data.recentResults.map((match) => <MatchCard match={match} key={match._id} />)}</div> : <EmptyState icon="bi-trophy" title="No results yet" message="Final scores will appear here." />}</section>
  </main>;
}
