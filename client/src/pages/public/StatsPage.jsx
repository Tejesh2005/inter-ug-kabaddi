import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicApi } from '../../api/public';
import { EmptyState, LoadingState, RequestError } from '../../components/admin/RequestState';

const boards = [['totalPoints', 'Total points'], ['raidPoints', 'Raiders'], ['tacklePoints', 'Defenders'], ['bonusPoints', 'Bonus points'], ['successfulRaids', 'Successful raids'], ['superTackles', 'Super tackles']];
const valueFor = (player, key) => key === 'totalPoints' ? player.totalPoints : key === 'raidPoints' ? player.raidStats.raidPoints : key === 'tacklePoints' ? player.defenceStats.tacklePoints : key === 'bonusPoints' ? player.raidStats.bonusPoints : key === 'successfulRaids' ? player.raidStats.successfulRaids : player.defenceStats.superTackles;

export default function StatsPage() {
  const [key, setKey] = useState('totalPoints'); const [data, setData] = useState(null); const [state, setState] = useState('loading');
  const load = useCallback(async () => { setState('loading'); try { const home = await publicApi.home(); setData(home.tournament ? await publicApi.leaderboards(home.tournament._id) : null); setState('ready'); } catch { setState('error'); } }, []);
  useEffect(() => { load(); }, [load]);
  if (state === 'loading') return <main className="public-page"><LoadingState /></main>;
  if (state === 'error') return <main className="public-page"><RequestError message="Statistics could not be loaded." onRetry={load} /></main>;
  if (!data) return <main className="public-page"><EmptyState icon="bi-trophy" title="No statistics yet" message="Player rankings will appear when the tournament is ready." /></main>;
  return <main className="public-page"><p className="public-kicker">{data.tournament.shortName} LEADERBOARDS</p><h1>Top performers</h1><div className="public-filter" role="tablist">{boards.map(([boardKey, label]) => <button type="button" role="tab" aria-selected={key === boardKey} className={key === boardKey ? 'active' : ''} onClick={() => setKey(boardKey)} key={boardKey}>{label}</button>)}</div><div className="leaderboard-list">{data.leaderboards[key].map((player, index) => <Link to={`/players/${player._id}`} key={player._id}><span>{index + 1}</span><div><strong>{player.name} <small>#{player.jerseyNumber}</small></strong><small>{player.teamId?.shortName ?? 'Team'} · {player.role}</small></div><b>{valueFor(player, key)}</b></Link>)}</div>{!data.leaderboards[key].length && <EmptyState icon="bi-trophy" title="No rankings yet" message="Statistics will arrive with recorded match events." />}</main>;
}
