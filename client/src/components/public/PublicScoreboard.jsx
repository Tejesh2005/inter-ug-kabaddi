import { useEffect, useMemo, useState } from 'react';

const id = (value) => value?._id ?? value;
const formatTimer = (milliseconds) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

export default function PublicScoreboard({ match, connectionStatus }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (match?.timerState?.status !== 'running') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [match?.timerState?.startedAt, match?.timerState?.status]);
  const time = useMemo(() => {
    const timer = match?.timerState;
    const saved = Number(timer?.remainingMilliseconds) || 0;
    return timer?.status === 'running' && timer.startedAt ? Math.max(0, saved - Math.max(0, now - new Date(timer.startedAt).getTime())) : saved;
  }, [match?.timerState, now]);
  const label = match.status === 'live' ? 'LIVE' : match.status === 'halftime' ? 'HALF TIME' : match.status === 'completed' ? 'FINAL' : 'UPCOMING';
  const raidingTeam = id(match.currentRaidingTeam) === id(match.teamA) ? match.teamA : match.teamB;
  return <section className="public-scoreboard" aria-label="Live match score">
    <div className="public-score-meta"><span className={match.status === 'live' ? 'live' : ''}>{label}</span><span>{connectionStatus === 'connected' ? 'LIVE UPDATES' : 'RECONNECTING…'}</span></div>
    <div className="public-score-grid"><div><strong>{match.teamA.shortName}</strong><b>{match.teamAScore}</b></div><div className="public-clock"><strong>{['live', 'halftime'].includes(match.status) ? formatTimer(time) : '--:--'}</strong><small>{match.currentHalf === 'not_started' ? 'PRE-MATCH' : match.currentHalf.replace('_', ' ').toUpperCase()}</small></div><div><strong>{match.teamB.shortName}</strong><b>{match.teamBScore}</b></div></div>
    <div className="public-raid-line"><span>{match.status === 'live' ? `${raidingTeam?.shortName ?? ''} RAID` : label}</span><strong>{match.currentRaider ? `${match.currentRaider.name} #${match.currentRaider.jerseyNumber}` : 'Raider pending'}</strong><span>Raid {match.raidNumber || '-'}</span></div>
  </section>;
}
