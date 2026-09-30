import { Link } from 'react-router-dom';

const statusLabel = (match) => match.status === 'live' ? 'LIVE' : match.status === 'halftime' ? 'HALF TIME' : match.status === 'completed' ? 'FINAL' : `${new Date(match.scheduledDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${match.scheduledTime}`;

export default function MatchCard({ match }) {
  return <Link className="public-match-card" to={`/match/${match._id}`}>
    <span className={`match-status ${match.status}`}>{statusLabel(match)}</span>
    <div className="match-card-score"><strong>{match.teamA.shortName}</strong><b>{match.teamAScore}</b><span>:</span><b>{match.teamBScore}</b><strong>{match.teamB.shortName}</strong></div>
    <small>{match.stage} · {match.venue}</small>
  </Link>;
}
