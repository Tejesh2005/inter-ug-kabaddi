import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { matchApi } from '../../api/management';

const apiMessage = (error) => error.response?.data?.message ?? 'Could not load matches.';

export default function ScoringMatchPicker() {
  const [matches, setMatches] = useState([]);
  const [state, setState] = useState({ loading: true, error: '' });

  useEffect(() => {
    let active = true;
    matchApi.list('all').then((items) => {
      if (active) setMatches(items.filter((match) => ['scheduled', 'upcoming', 'live', 'halftime'].includes(match.status)));
    }).catch((error) => {
      if (active) setState({ loading: false, error: apiMessage(error) });
    }).finally(() => {
      if (active) setState((current) => ({ ...current, loading: false }));
    });
    return () => { active = false; };
  }, []);

  return (
    <section className="scoring-picker" aria-labelledby="scoring-picker-title">
      <div><h2 id="scoring-picker-title">Scoring desk</h2><p>Open a prepared fixture or return to a live match.</p></div>
      {state.loading ? <div className="scoring-picker-state">Loading matches...</div> : state.error ? <div className="scoring-picker-state error" role="alert">{state.error}</div> : matches.length === 0 ? <div className="scoring-picker-state">No matches are ready for scoring.</div> : (
        <div className="scoring-picker-list">{matches.slice(0, 5).map((match) => <Link to={`/admin/matches/${match._id}/scoring`} key={match._id}><span><strong>{match.teamA.shortName} vs {match.teamB.shortName}</strong><small>Match {match.matchNumber} - {match.stage}</small></span><b className={match.status}>{match.status === 'live' ? 'LIVE' : 'OPEN'}</b><i className="bi bi-chevron-right" aria-hidden="true" /></Link>)}</div>
      )}
    </section>
  );
}
