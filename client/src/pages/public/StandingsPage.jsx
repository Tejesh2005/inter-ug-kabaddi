import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicApi } from '../../api/public';
import { EmptyState, LoadingState, RequestError } from '../../components/admin/RequestState';

export default function StandingsPage() {
  const [state, setState] = useState('loading'); const [home, setHome] = useState(null); const [data, setData] = useState(null);
  const load = useCallback(async () => { setState('loading'); try { const homeData = await publicApi.home(); setHome(homeData); setData(homeData.tournament ? await publicApi.standings(homeData.tournament._id) : null); setState('ready'); } catch { setState('error'); } }, []);
  useEffect(() => { load(); }, [load]);
  if (state === 'loading') return <main className="public-page"><LoadingState /></main>;
  if (state === 'error') return <main className="public-page"><RequestError message="Standings could not be loaded." onRetry={load} /></main>;
  if (!data) return <main className="public-page"><EmptyState icon="bi-bar-chart" title="No tournament selected" message="Standings appear when a tournament is available." /></main>;
  return <main className="public-page"><p className="public-kicker">{data.tournament.shortName} TABLE</p><h1>Standings</h1><p className="public-summary">Ranked by {data.tournament.standingsRules.primary.replace(/([A-Z])/g, ' $1').toLowerCase()}, then the tournament tie-break rules.</p><div className="standings-cards">{data.standings.map((row) => <article className="standing-card" key={row.team._id}><span className="standing-position">{row.position}</span><div><strong>{row.team.name}</strong><small>{row.matchesPlayed} played · {row.wins} won · {row.scoreDifference > 0 ? '+' : ''}{row.scoreDifference} difference</small><div className="form-row" aria-label={`Recent form: ${row.form.join(', ') || 'none'}`}>{row.form.length ? row.form.map((value, index) => <span key={`${value}-${index}`} className={value.toLowerCase()}>{value}</span>) : <span className="none">-</span>}</div></div><b>{row.leaguePoints}<small>PTS</small></b></article>)}</div>{data.standings.length === 0 && <EmptyState icon="bi-bar-chart" title="No teams to rank" message="Completed fixtures will build the table." />}<Link className="public-link-button" to="/matches">View fixtures</Link></main>;
}
