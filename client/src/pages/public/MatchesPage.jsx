import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MatchCard from '../../components/public/MatchCard';
import { publicApi } from '../../api/public';
import { EmptyState, LoadingState, RequestError } from '../../components/admin/RequestState';

const filters = [['all', 'All'], ['live', 'Live'], ['upcoming', 'Upcoming'], ['completed', 'Final']];
export default function MatchesPage() {
  const [params, setParams] = useSearchParams(); const filter = filters.some(([value]) => value === params.get('filter')) ? params.get('filter') : 'all'; const [matches, setMatches] = useState([]); const [state, setState] = useState('loading');
  const load = useCallback(async () => { setState('loading'); try { setMatches(await publicApi.matches(filter)); setState('ready'); } catch { setState('error'); } }, [filter]);
  useEffect(() => { load(); }, [load]);
  return <main className="public-page"><p className="public-kicker">FIXTURES & RESULTS</p><h1>Every match</h1><div className="public-filter" role="tablist">{filters.map(([value, label]) => <button type="button" role="tab" aria-selected={filter === value} className={filter === value ? 'active' : ''} onClick={() => setParams(value === 'all' ? {} : { filter: value })} key={value}>{label}</button>)}</div>{state === 'loading' ? <LoadingState /> : state === 'error' ? <RequestError message="Fixtures could not be loaded." onRetry={load} /> : matches.length ? <div className="public-match-list">{matches.map((match) => <MatchCard key={match._id} match={match} />)}</div> : <EmptyState icon="bi-calendar3" title="No matches here" message="Fixtures will appear once they are scheduled." />}</main>;
}
