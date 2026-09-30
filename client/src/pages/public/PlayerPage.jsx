import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { publicApi } from '../../api/public';
import { LoadingState, RequestError } from '../../components/admin/RequestState';

const group = (title, items) => <section className="public-section"><h2>{title}</h2><div className="stat-grid">{items.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>;
export default function PlayerPage() {
  const { playerId } = useParams(); const [player, setPlayer] = useState(null); const [error, setError] = useState('');
  const load = useCallback(async () => { try { setPlayer(await publicApi.player(playerId)); setError(''); } catch { setError('Player details could not be loaded.'); } }, [playerId]); useEffect(() => { load(); }, [load]);
  if (!player && !error) return <main className="public-page"><LoadingState /></main>; if (!player) return <main className="public-page"><RequestError message={error} onRetry={load} /></main>;
  return <main className="public-page"><Link className="section-back" to={`/teams/${player.teamId._id}`}><i className="bi bi-chevron-left" />{player.teamId.shortName}</Link><section className="profile-hero"><span className="profile-jersey">{player.jerseyNumber}</span><div><p className="public-kicker">{player.role}{player.isCaptain ? ' · CAPTAIN' : player.isViceCaptain ? ' · VICE CAPTAIN' : ''}</p><h1>{player.name}</h1><Link to={`/teams/${player.teamId._id}`}>{player.teamId.name}</Link></div></section>{group('Overall', [['Matches', player.matchesPlayed], ['Total points', player.totalPoints]])}{group('Raid', [['Raid points', player.raidStats.raidPoints], ['Touch points', player.raidStats.touchPoints], ['Bonus points', player.raidStats.bonusPoints], ['Successful raids', player.raidStats.successfulRaids], ['Super raids', player.raidStats.superRaids], ['Do-or-die points', player.raidStats.doOrDieRaidPoints]])}{group('Defence', [['Tackle points', player.defenceStats.tacklePoints], ['Successful tackles', player.defenceStats.successfulTackles], ['Super tackles', player.defenceStats.superTackles]])}</main>;
}
