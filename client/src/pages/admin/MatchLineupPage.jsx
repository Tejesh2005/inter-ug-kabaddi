import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { lineupApi, matchApi, teamApi } from '../../api/management';
import LineupPlayerCard from '../../components/admin/LineupPlayerCard';
import { LoadingState, RequestError } from '../../components/admin/RequestState';

const emptyLineup = () => ({ startingSeven: [], substitutes: [], captain: '' });
const apiMessage = (error) => error.response?.data?.message ?? 'Check your connection and try again.';
const playerId = (player) => player._id ?? player;

export default function MatchLineupPage() {
  const { matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [teams, setTeams] = useState({ teamA: null, teamB: null });
  const [lineups, setLineups] = useState({ teamA: emptyLineup(), teamB: emptyLineup() });
  const [firstRaidingTeam, setFirstRaidingTeam] = useState('');
  const [step, setStep] = useState('teamA');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const settings = match?.tournamentId?.settings ?? match?.settings ?? { numberOfPlayersOnCourt: 7, maximumSquadSize: 12 };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const matchData = await matchApi.get(matchId);
      const [teamAData, teamBData, lineupData] = await Promise.all([
        teamApi.get(matchData.teamA._id), teamApi.get(matchData.teamB._id), lineupApi.get(matchId),
      ]);
      setMatch(matchData);
      setTeams({ teamA: teamAData, teamB: teamBData });
      const byTeam = new Map(lineupData.lineups.map((lineup) => [lineup.teamId._id ?? lineup.teamId, lineup]));
      const convert = (teamId) => {
        const existing = byTeam.get(teamId);
        return existing ? { startingSeven: existing.startingSeven.map(playerId), substitutes: existing.substitutes.map(playerId), captain: playerId(existing.captain) } : emptyLineup();
      };
      setLineups({ teamA: convert(matchData.teamA._id), teamB: convert(matchData.teamB._id) });
      setFirstRaidingTeam(lineupData.firstRaidingTeam ?? matchData.teamA._id);
    } catch (requestError) { setError(apiMessage(requestError)); }
    finally { setLoading(false); }
  }, [matchId]);
  useEffect(() => { load(); }, [load]);

  const selectionFor = (side, id) => lineups[side].startingSeven.includes(id) ? 'starter' : lineups[side].substitutes.includes(id) ? 'substitute' : 'none';
  const selectPlayer = (side, id, target) => {
    setError('');
    setLineups((current) => {
      const lineup = current[side];
      const existing = lineup.startingSeven.includes(id) ? 'starter' : lineup.substitutes.includes(id) ? 'substitute' : 'none';
      const nextTarget = existing === target ? 'none' : target;
      if (nextTarget === 'starter' && existing !== 'starter' && lineup.startingSeven.length >= settings.numberOfPlayersOnCourt) {
        setError(`Only ${settings.numberOfPlayersOnCourt} starting players can be selected.`); return current;
      }
      const currentTotal = lineup.startingSeven.length + lineup.substitutes.length;
      if (nextTarget !== 'none' && existing === 'none' && currentTotal >= settings.maximumSquadSize) {
        setError(`The match squad cannot exceed ${settings.maximumSquadSize} players.`); return current;
      }
      const startingSeven = lineup.startingSeven.filter((player) => player !== id);
      const substitutes = lineup.substitutes.filter((player) => player !== id);
      if (nextTarget === 'starter') startingSeven.push(id);
      if (nextTarget === 'substitute') substitutes.push(id);
      return { ...current, [side]: { startingSeven, substitutes, captain: nextTarget === 'none' && lineup.captain === id ? '' : lineup.captain } };
    });
  };
  const setCaptain = (side, id) => setLineups((current) => ({ ...current, [side]: { ...current[side], captain: id } }));

  const playerMaps = useMemo(() => ({
    teamA: new Map((teams.teamA?.players ?? []).map((player) => [player._id, player])),
    teamB: new Map((teams.teamB?.players ?? []).map((player) => [player._id, player])),
  }), [teams]);

  const validateReview = () => {
    for (const side of ['teamA', 'teamB']) {
      const label = teams[side].shortName;
      if (lineups[side].startingSeven.length !== settings.numberOfPlayersOnCourt) return `${label} needs exactly ${settings.numberOfPlayersOnCourt} starting players.`;
      if (!lineups[side].captain) return `Select a captain for ${label}.`;
    }
    if (!firstRaidingTeam) return 'Select the first raiding team.';
    return '';
  };

  const save = async () => {
    const validationError = validateReview();
    if (validationError) { setError(validationError); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      await lineupApi.save(matchId, { ...lineups, firstRaidingTeam });
      setNotice('Lineups confirmed and saved.');
    } catch (requestError) { setError(apiMessage(requestError)); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingState />;
  if (!match || !teams.teamA || !teams.teamB) return <RequestError message={error || 'Match not found'} onRetry={load} />;

  const renderTeam = (side) => {
    const team = teams[side];
    const lineup = lineups[side];
    return <div className="lineup-team-panel"><div className="lineup-counts"><strong>{team.shortName}</strong><span>{lineup.startingSeven.length}/{settings.numberOfPlayersOnCourt} starting</span><span>{lineup.substitutes.length} substitutes</span></div><div className="lineup-player-list">{team.players.map((player) => <LineupPlayerCard key={player._id} player={player} selection={selectionFor(side, player._id)} isCaptain={lineup.captain === player._id} onSelect={(id, target) => selectPlayer(side, id, target)} onCaptain={(id) => setCaptain(side, id)} />)}</div></div>;
  };

  const names = (side, ids) => ids.map((id) => playerMaps[side].get(id)?.name).filter(Boolean);

  return (
    <section className="lineup-page">
      <Link className="section-back" to="/admin/matches"><i className="bi bi-chevron-left" />All matches</Link>
      <header className="lineup-header"><p className="eyebrow">MATCH {match.matchNumber} · PRE-MATCH</p><h1>Select lineups</h1><p>{match.teamA.shortName} vs {match.teamB.shortName} · Choose the starting {settings.numberOfPlayersOnCourt}, substitutes, captains, and first raid.</p></header>
      <nav className="lineup-steps" aria-label="Lineup steps">
        <button className={step === 'teamA' ? 'active' : ''} type="button" onClick={() => setStep('teamA')}>1 <span>{match.teamA.shortName}</span></button>
        <button className={step === 'teamB' ? 'active' : ''} type="button" onClick={() => setStep('teamB')}>2 <span>{match.teamB.shortName}</span></button>
        <button className={step === 'review' ? 'active' : ''} type="button" onClick={() => setStep('review')}>3 <span>Review</span></button>
      </nav>
      {error && <div className="inline-form-error" role="alert">{error}</div>}
      {notice && <div className="save-notice" role="status"><i className="bi bi-check-circle" />{notice}</div>}
      {step === 'teamA' && renderTeam('teamA')}
      {step === 'teamB' && renderTeam('teamB')}
      {step === 'review' && <div className="lineup-review">
        {['teamA', 'teamB'].map((side) => <article className="lineup-summary" key={side}><h2>{teams[side].shortName}</h2><p><strong>Starting</strong>{names(side, lineups[side].startingSeven).join(', ') || 'Not selected'}</p><p><strong>Substitutes</strong>{names(side, lineups[side].substitutes).join(', ') || 'None'}</p><p><strong>Captain</strong>{playerMaps[side].get(lineups[side].captain)?.name || 'Not selected'}</p></article>)}
        <fieldset className="first-raid"><legend>First raiding team</legend>{['teamA', 'teamB'].map((side) => <label key={side} className={firstRaidingTeam === teams[side]._id ? 'active' : ''}><input type="radio" name="firstRaidingTeam" value={teams[side]._id} checked={firstRaidingTeam === teams[side]._id} onChange={(event) => setFirstRaidingTeam(event.target.value)} /><span>{teams[side].shortName}</span></label>)}</fieldset>
        <button className="confirm-lineups" type="button" onClick={save} disabled={saving}>{saving ? 'Saving lineups…' : 'Confirm lineups'}</button>
      </div>}
      <div className="lineup-next">{step !== 'review' && <button type="button" onClick={() => setStep(step === 'teamA' ? 'teamB' : 'review')}>Continue to {step === 'teamA' ? match.teamB.shortName : 'review'}<i className="bi bi-chevron-right" /></button>}</div>
    </section>
  );
}
