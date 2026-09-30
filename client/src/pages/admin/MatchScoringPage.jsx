import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { lineupApi, matchApi, scoringApi } from '../../api/management';
import ScoringConfirmSheet from '../../components/admin/ScoringConfirmSheet';
import ScoringPlayerCard from '../../components/admin/ScoringPlayerCard';
import { LoadingState, RequestError } from '../../components/admin/RequestState';
import { useAuth } from '../../context/AuthContext';
import { useMatchRealtime } from '../../hooks/useMatchRealtime';

const apiMessage = (error) => error.response?.data?.message ?? 'Check your connection and try again.';
const id = (value) => value?._id ?? value;
const lifecycleKinds = new Set(['start', 'timerStart', 'timerPause', 'timerResume', 'firstHalfEnd', 'secondHalfStart', 'endMatch', 'reopen']);
const lifecycleEventTypes = new Set(['MATCH_START', 'TIMER_START', 'TIMER_PAUSE', 'TIMER_RESUME', 'FIRST_HALF_END', 'SECOND_HALF_START', 'MATCH_END', 'MATCH_REOPEN']);
const formatTimer = (milliseconds) => {
  const safe = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};
const modes = [
  ['empty', 'bi-dash-circle', 'Empty raid'],
  ['touch', 'bi-hand-index-thumb', 'Touch'],
  ['bonus', 'bi-plus-circle', 'Bonus'],
  ['touchBonus', 'bi-stars', 'Touch + bonus'],
  ['tackle', 'bi-shield-fill', 'Raider tackled'],
  ['substitution', 'bi-arrow-left-right', 'Substitute player'],
  ['technical', 'bi-flag-fill', 'Technical point'],
  ['correction', 'bi-pencil-square', 'Correction'],
];

export default function MatchScoringPage() {
  const { matchId } = useParams();
  const { admin } = useAuth();
  const [match, setMatch] = useState(null);
  const [lineups, setLineups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState('');
  const [raiderId, setRaiderId] = useState('');
  const [touchedIds, setTouchedIds] = useState([]);
  const [tacklerId, setTacklerId] = useState('');
  const [assistIds, setAssistIds] = useState([]);
  const [technicalTeam, setTechnicalTeam] = useState('');
  const [technicalReason, setTechnicalReason] = useState('');
  const [correctionTeam, setCorrectionTeam] = useState('');
  const [correctionAmount, setCorrectionAmount] = useState(1);
  const [correctionReason, setCorrectionReason] = useState('');
  const [substitutionTeam, setSubstitutionTeam] = useState('');
  const [outgoingPlayerId, setOutgoingPlayerId] = useState('');
  const [incomingPlayerId, setIncomingPlayerId] = useState('');
  const [preview, setPreview] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [clockNow, setClockNow] = useState(Date.now());

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [matchData, lineupData, latestEvent] = await Promise.all([matchApi.get(matchId), lineupApi.get(matchId), scoringApi.latestEvent(matchId)]);
      setMatch(matchData);
      setLineups(lineupData.lineups);
      setTechnicalTeam(id(matchData.teamA));
      setCorrectionTeam(id(matchData.teamA));
      setSubstitutionTeam(id(matchData.teamA));
      setLastEvent(latestEvent);
    } catch (requestError) { setError(apiMessage(requestError)); }
    finally { setLoading(false); }
  }, [matchId]);

  useEffect(() => { load(); }, [load]);

  const applyRealtimeState = useCallback(({ match: updatedMatch, event }) => {
    if (!updatedMatch) return;
    setMatch((current) => current ? {
      ...current,
      ...updatedMatch,
      teamA: current.teamA,
      teamB: current.teamB,
      tournamentId: current.tournamentId,
    } : current);
    if (event?.type === 'UNDO' || lifecycleEventTypes.has(event?.type)) {
      scoringApi.latestEvent(matchId).then(setLastEvent).catch(() => {});
    } else if (event) {
      setLastEvent(event);
    }
  }, [matchId]);

  const connectionStatus = useMatchRealtime(matchId, { onState: applyRealtimeState, onReconnect: load });
  const canScore = connectionStatus === 'connected';

  useEffect(() => {
    if (match?.timerState?.status !== 'running') return undefined;
    setClockNow(Date.now());
    const timer = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [match?.timerState?.status, match?.timerState?.startedAt]);

  const teams = useMemo(() => ({ A: match?.teamA, B: match?.teamB }), [match]);
  const settings = match?.tournamentId?.settings ?? {};
  const lineupByTeam = useMemo(() => new Map(lineups.map((lineup) => [id(lineup.teamId), lineup])), [lineups]);
  const playerMap = useMemo(() => new Map(lineups.flatMap((lineup) => [...lineup.startingSeven, ...lineup.substitutes]).map((player) => [id(player), player])), [lineups]);
  const sideForTeam = (teamId) => id(match.teamA) === id(teamId) ? 'A' : 'B';
  const raidingSide = match ? sideForTeam(match.currentRaidingTeam) : 'A';
  const defendingSide = raidingSide === 'A' ? 'B' : 'A';
  const courtIds = (side) => (match?.[`team${side}PlayersOnCourt`] ?? []).map(id);
  const activePlayers = (side) => courtIds(side).map((playerId) => playerMap.get(playerId)).filter(Boolean);
  const raiders = activePlayers(raidingSide);
  const defenders = activePlayers(defendingSide);
  const selectedRaider = playerMap.get(raiderId);
  const substitutionSide = substitutionTeam ? sideForTeam(substitutionTeam) : 'A';
  const substitutionLineup = lineupByTeam.get(substitutionTeam);
  const eligibleSubstitutes = (substitutionLineup?.substitutes ?? []).filter((player) => !courtIds(substitutionSide).includes(id(player)) && !(match?.[`team${substitutionSide}SubstitutedOutPlayers`] ?? []).map(id).includes(id(player)));
  const timerRemaining = useMemo(() => {
    const timer = match?.timerState;
    const stored = Math.max(0, Number(timer?.remainingMilliseconds) || 0);
    if (timer?.status !== 'running' || !timer.startedAt) return stored;
    return Math.max(0, stored - Math.max(0, clockNow - new Date(timer.startedAt).getTime()));
  }, [clockNow, match?.timerState]);

  const resetSelection = () => {
    setMode(''); setTouchedIds([]); setTacklerId(''); setAssistIds([]); setTechnicalReason(''); setCorrectionReason(''); setOutgoingPlayerId(''); setIncomingPlayerId(''); setPreview(null); setPendingAction(null); setError('');
  };

  const selectMode = (nextMode) => {
    setMode(nextMode); setTouchedIds([]); setTacklerId(''); setAssistIds([]); setOutgoingPlayerId(''); setIncomingPlayerId(''); setError(''); setNotice('');
  };

  const openStartConfirmation = () => {
    setPendingAction({ kind: 'start', payload: {} });
    setPreview({ title: 'Start this match?', details: [{ label: 'Fixture', value: `${match.teamA.shortName} vs ${match.teamB.shortName}` }, { label: 'First raid', value: id(match.currentRaidingTeam) === id(match.teamA) ? match.teamA.shortName : match.teamB.shortName }], hidePoints: true, buttonLabel: 'Start match' });
  };

  const prepareAction = () => {
    if (!['technical', 'correction', 'substitution'].includes(mode) && !raiderId) { setError('Select the current raider first.'); return; }
    const raidTeam = teams[raidingSide];
    const defenceTeam = teams[defendingSide];
    let action;
    let nextPreview;
    if (['empty', 'touch', 'bonus', 'touchBonus'].includes(mode)) {
      if (['touch', 'touchBonus'].includes(mode) && touchedIds.length === 0) { setError('Select at least one touched defender.'); return; }
      const bonus = ['bonus', 'touchBonus'].includes(mode);
      const allOut = touchedIds.length > 0 && touchedIds.length === defenders.length ? settings.allOutPoints ?? 2 : 0;
      const points = touchedIds.length + (bonus ? 1 : 0) + allOut;
      action = { kind: 'raid', payload: { raiderId, touchedPlayerIds: touchedIds, bonus } };
      nextPreview = { title: mode === 'empty' ? 'Confirm empty raid' : 'Confirm raid result', teamName: raidTeam.shortName, points, details: [{ label: 'Raider', value: `${selectedRaider.name} #${selectedRaider.jerseyNumber}` }, ...(touchedIds.length ? [{ label: 'Touched', value: touchedIds.map((playerId) => playerMap.get(playerId)?.name).join(', ') }] : []), ...(bonus ? [{ label: 'Bonus', value: 'Yes' }] : []), ...(allOut ? [{ label: 'All out', value: `+${allOut}` }] : [])] };
    } else if (mode === 'tackle') {
      if (!tacklerId) { setError('Select the primary tackler.'); return; }
      const isSuper = settings.superTackleEnabled && defenders.length <= (settings.superTackleThreshold ?? 3);
      const tacklePoints = isSuper ? settings.superTacklePoints ?? 2 : settings.normalTacklePoints ?? 1;
      const allOut = activePlayers(raidingSide).length === 1 ? settings.allOutPoints ?? 2 : 0;
      action = { kind: 'tackle', payload: { raiderId, tacklerId, assistPlayerIds: assistIds } };
      nextPreview = { title: isSuper ? 'Confirm super tackle' : 'Confirm tackle', teamName: defenceTeam.shortName, points: tacklePoints + allOut, details: [{ label: 'Raider out', value: `${selectedRaider.name} #${selectedRaider.jerseyNumber}` }, { label: 'Primary tackler', value: playerMap.get(tacklerId)?.name }, ...(assistIds.length ? [{ label: 'Support', value: assistIds.map((playerId) => playerMap.get(playerId)?.name).join(', ') }] : []), ...(allOut ? [{ label: 'All out', value: `+${allOut}` }] : [])] };
    } else if (mode === 'substitution') {
      if (!outgoingPlayerId || !incomingPlayerId) { setError('Choose both the outgoing player and replacement.'); return; }
      const team = substitutionSide === 'A' ? match.teamA : match.teamB;
      action = { kind: 'substitute', payload: { teamId: substitutionTeam, outgoingPlayerId, incomingPlayerId } };
      nextPreview = { title: 'Confirm substitution', teamName: team.shortName, hidePoints: true, buttonLabel: 'Record substitution', details: [{ label: 'Team', value: team.name }, { label: 'Player out', value: playerMap.get(outgoingPlayerId)?.name ?? 'Selected player' }, { label: 'Player in', value: playerMap.get(incomingPlayerId)?.name ?? 'Selected substitute' }] };
    } else if (mode === 'technical') {
      if (!technicalReason.trim()) { setError('Enter a reason for the technical point.'); return; }
      const team = id(match.teamA) === technicalTeam ? match.teamA : match.teamB;
      action = { kind: 'technicalPoint', payload: { teamId: technicalTeam, points: 1, reason: technicalReason.trim() } };
      nextPreview = { title: 'Confirm technical point', teamName: team.shortName, points: 1, details: [{ label: 'Award to', value: team.name }, { label: 'Reason', value: technicalReason.trim() }] };
    } else if (mode === 'correction') {
      if (!correctionReason.trim()) { setError('Enter a reason for the score correction.'); return; }
      const team = id(match.teamA) === correctionTeam ? match.teamA : match.teamB;
      action = { kind: 'correction', payload: { teamId: correctionTeam, adjustment: Number(correctionAmount), reason: correctionReason.trim() } };
      nextPreview = { title: 'Confirm score correction', teamName: team.shortName, points: Number(correctionAmount), danger: true, buttonLabel: 'Apply correction', details: [{ label: 'Adjust team', value: team.name }, { label: 'Score change', value: Number(correctionAmount) > 0 ? `+${correctionAmount}` : String(correctionAmount) }, { label: 'Reason', value: correctionReason.trim() }] };
    } else { setError('Choose a raid result.'); return; }
    setPendingAction(action); setPreview(nextPreview); setError('');
  };

  const performAction = async (action) => {
    if (!action || submitting) return;
    if (!canScore) { setError('Connection lost. Scoring is temporarily disabled until the latest match state is refreshed.'); return; }
    setSubmitting(true); setError('');
    try {
      const payload = { ...action.payload, actionId: crypto.randomUUID() };
      const result = await scoringApi[action.kind](matchId, payload);
      setMatch((current) => ({ ...current, ...result.match, teamA: current.teamA, teamB: current.teamB, tournamentId: current.tournamentId }));
      setLastEvent(action.kind === 'undo' || lifecycleKinds.has(action.kind) ? await scoringApi.latestEvent(matchId) : result.event);
      if (!lifecycleKinds.has(action.kind)) {
        setRaiderId('');
        resetSelection();
      } else {
        setPreview(null); setPendingAction(null);
      }
      setNotice(result.duplicate ? 'This action was already recorded.' : 'Action recorded. Match state updated.');
    } catch (requestError) { setError(apiMessage(requestError)); setPreview(null); setPendingAction(null); }
    finally { setSubmitting(false); }
  };

  const confirmAction = () => performAction(pendingAction);

  const toggleTimer = () => {
    const status = match.timerState?.status;
    const kind = status === 'running' ? 'timerPause' : status === 'paused' ? 'timerResume' : 'timerStart';
    performAction({ kind, payload: {} });
  };

  const openUndoConfirmation = () => {
    if (!lastEvent) return;
    setPendingAction({ kind: 'undo', payload: { eventId: lastEvent._id } });
    setPreview({ title: 'Undo last scoring action?', hidePoints: true, danger: true, buttonLabel: 'Yes, undo action', details: [{ label: 'Event', value: `#${lastEvent.eventNumber} ${lastEvent.type.replaceAll('_', ' ')}` }, { label: 'Action', value: lastEvent.description }, { label: 'Score after', value: `${lastEvent.teamAScoreAfter} - ${lastEvent.teamBScoreAfter}` }] });
  };

  const openLifecycleConfirmation = (kind) => {
    const score = `${match.teamA.shortName} ${match.teamAScore} - ${match.teamBScore} ${match.teamB.shortName}`;
    if (kind === 'firstHalfEnd') {
      setPendingAction({ kind, payload: {} });
      setPreview({ title: 'End the first half?', hidePoints: true, danger: true, buttonLabel: 'End first half', details: [{ label: 'Current score', value: score }, { label: 'Timer', value: formatTimer(timerRemaining) }, { label: 'Next state', value: 'Scoring locked for halftime' }] });
    } else if (kind === 'secondHalfStart') {
      setPendingAction({ kind, payload: {} });
      setPreview({ title: 'Start the second half?', hidePoints: true, buttonLabel: 'Start second half', details: [{ label: 'Halftime score', value: score }, { label: 'Timer', value: `${settings.halfDuration ?? 20}:00, ready to start` }] });
    } else if (kind === 'endMatch') {
      const winner = match.teamAScore === match.teamBScore ? 'Draw' : match.teamAScore > match.teamBScore ? match.teamA.name : match.teamB.name;
      setPendingAction({ kind, payload: {} });
      setPreview({ title: 'End this match?', hidePoints: true, danger: true, buttonLabel: 'End match', details: [{ label: 'Final score', value: score }, { label: 'Result', value: winner }, { label: 'Effect', value: 'Scoring will be locked and statistics updated' }] });
    } else if (kind === 'reopen') {
      setPendingAction({ kind, payload: {} });
      setPreview({ title: 'Reopen this match?', hidePoints: true, danger: true, buttonLabel: 'Reopen match', details: [{ label: 'Recorded result', value: score }, { label: 'Effect', value: 'Result statistics will be reversed' }, { label: 'Timer', value: 'Restored in paused state' }] });
    }
  };

  if (loading) return <LoadingState />;
  if (!match) return <RequestError message={error || 'Match not found'} onRetry={load} />;

  const isPreMatch = ['scheduled', 'upcoming'].includes(match.status);
  const isLive = match.status === 'live';
  const isHalftime = match.status === 'halftime';
  const isCompleted = match.status === 'completed';
  const currentRaidName = id(match.currentRaidingTeam) === id(match.teamA) ? match.teamA.shortName : match.teamB.shortName;
  const timerStatus = match.timerState?.status ?? 'stopped';

  return (
    <section className="scoring-page">
      <Link className="section-back scoring-back" to="/admin"><i className="bi bi-chevron-left" />Scoring desk</Link>
      <header className="scoring-scoreboard">
        <div className="scoreboard-status"><span className={isLive ? 'live' : ''}>{isLive ? 'LIVE' : match.status.toUpperCase()}</span><b>{match.currentHalf === 'not_started' ? 'PRE-MATCH' : match.currentHalf.replace('_', ' ').toUpperCase()}</b><small>{connectionStatus === 'connected' ? `Raid ${match.raidNumber || '-'}` : 'SYNCING…'}</small></div>
        <div className="scoreboard-main">
          <div className="score-team"><span style={{ '--team-color': match.teamA.primaryColor }}>{match.teamA.shortName.slice(0, 3)}</span><strong>{match.teamA.shortName}</strong><b>{match.teamAScore}</b></div>
          <div className={`scoreboard-clock ${timerStatus === 'running' ? 'running' : ''}`}><i className="bi bi-stopwatch" aria-hidden="true" /><strong>{isPreMatch ? '--:--' : formatTimer(timerRemaining)}</strong><small>{isLive ? `${currentRaidName} RAID` : isHalftime ? 'HALF TIME' : isCompleted ? 'FINAL' : 'TIMER READY'}</small></div>
          <div className="score-team"><span style={{ '--team-color': match.teamB.primaryColor }}>{match.teamB.shortName.slice(0, 3)}</span><strong>{match.teamB.shortName}</strong><b>{match.teamBScore}</b></div>
        </div>
      </header>

      {error && <div className="scoring-alert error" role="alert"><i className="bi bi-exclamation-triangle" />{error}</div>}
      {!canScore && <div className="connection-alert" role="alert"><i className="bi bi-wifi-off" />{connectionStatus === 'connecting' ? 'Reconnecting. Scoring is temporarily disabled.' : 'Connection lost. Scoring is temporarily disabled.'}</div>}
      {notice && <div className="scoring-alert success" role="status"><i className="bi bi-check-circle" />{notice}</div>}

      {isLive && <section className={`timer-control-panel ${timerRemaining === 0 ? 'expired' : ''}`} aria-label="Match timer controls"><div><span>{timerStatus === 'running' ? 'TIMER RUNNING' : timerStatus === 'paused' ? 'TIMER PAUSED' : 'TIMER READY'}</span><strong>{formatTimer(timerRemaining)}</strong><small>{match.currentHalf === 'first' ? 'First half' : 'Second half'}</small></div><div className="timer-control-actions"><button className={timerStatus === 'running' ? 'pause' : 'run'} type="button" onClick={toggleTimer} disabled={submitting || (timerStatus !== 'running' && timerRemaining === 0)}><i className={`bi ${timerStatus === 'running' ? 'bi-pause-fill' : 'bi-play-fill'}`} />{timerStatus === 'running' ? 'Pause timer' : timerStatus === 'paused' ? 'Resume timer' : 'Start timer'}</button><button className="period-end" type="button" onClick={() => openLifecycleConfirmation(match.currentHalf === 'first' ? 'firstHalfEnd' : 'endMatch')} disabled={submitting}><i className="bi bi-stop-fill" />{match.currentHalf === 'first' ? 'End first half' : 'End match'}</button></div></section>}

      {isPreMatch ? <div className="start-match-panel"><i className="bi bi-whistle" aria-hidden="true" /><h1>Ready for first raid</h1><p>Confirmed lineups will become the on-court players. {currentRaidName} raids first.</p><div><span>{match.teamA.shortName}<b>{lineupByTeam.get(id(match.teamA))?.startingSeven.length ?? 0} starters</b></span><span>{match.teamB.shortName}<b>{lineupByTeam.get(id(match.teamB))?.startingSeven.length ?? 0} starters</b></span></div><button type="button" onClick={openStartConfirmation}>Start match</button></div> : isHalftime ? <div className="match-transition-panel halftime-panel"><i className="bi bi-hourglass-split" aria-hidden="true" /><span>HALF TIME</span><h1>{match.teamA.shortName} {match.teamAScore} - {match.teamBScore} {match.teamB.shortName}</h1><p>The first-half score is saved. Normal scoring remains locked until the second half starts.</p><button type="button" onClick={() => openLifecycleConfirmation('secondHalfStart')} disabled={submitting}>Start second half</button>{admin.role === 'SUPER_ADMIN' && <Link to={`/admin/matches/${matchId}/audit`}>View audit history</Link>}</div> : isCompleted ? <div className="match-transition-panel completed-panel"><i className="bi bi-trophy-fill" aria-hidden="true" /><span>FINAL</span><h1>{match.teamA.shortName} {match.teamAScore} - {match.teamBScore} {match.teamB.shortName}</h1><p>{match.resultText || 'Match completed'}. Scoring and timer controls are locked.</p><div>{admin.role === 'SUPER_ADMIN' && <button className="reopen-match" type="button" onClick={() => openLifecycleConfirmation('reopen')} disabled={submitting}>Reopen match</button>}<Link to={`/admin/matches/${matchId}/audit`}>View audit history</Link></div></div> : !isLive ? <div className="scoring-locked"><i className="bi bi-lock-fill" /><h1>Scoring is locked</h1><p>This match is currently {match.status}. Live actions are available only during an active half.</p></div> : (
        <div className={`scoring-workspace ${canScore ? '' : 'connection-locked'}`} aria-disabled={!canScore}>
          <section className="scoring-section"><div className="scoring-section-heading"><div><h1>Select raider</h1><p>{teams[raidingSide].shortName} has {raiders.length} players on court</p></div><strong>{teams[raidingSide].shortName} RAID</strong></div><div className="scoring-player-grid">{raiders.map((player) => <ScoringPlayerCard player={player} key={player._id} selected={raiderId === player._id} onClick={() => { setRaiderId(player._id); setError(''); }} />)}</div></section>

          <section className="scoring-section"><div className="scoring-section-heading"><div><h2>Raid result</h2><p>Choose one result, then review it before applying.</p></div></div><div className="raid-actions">{modes.filter(([key]) => key !== 'bonus' || settings.bonusEnabled !== false).map(([key, icon, label]) => <button className={`${mode === key ? 'active' : ''} ${key === 'tackle' ? 'tackle' : ''}`} type="button" key={key} onClick={() => selectMode(key)}><i className={`bi ${icon}`} aria-hidden="true" /><span>{label}</span></button>)}</div></section>

          {['touch', 'touchBonus'].includes(mode) && <section className="scoring-section result-panel"><div className="scoring-section-heading"><div><h2>Select touched defenders</h2><p>Tap every defender who is out from this raid.</p></div><strong>{touchedIds.length} selected</strong></div><div className="scoring-player-grid">{defenders.map((player) => <ScoringPlayerCard player={player} key={player._id} selected={touchedIds.includes(player._id)} onClick={() => setTouchedIds((current) => current.includes(player._id) ? current.filter((value) => value !== player._id) : [...current, player._id])} />)}</div></section>}

          {mode === 'tackle' && <section className="scoring-section result-panel"><div className="scoring-section-heading"><div><h2>Select primary tackler</h2><p>Choose the defender credited with the tackle.</p></div>{settings.superTackleEnabled && defenders.length <= (settings.superTackleThreshold ?? 3) && <strong>SUPER TACKLE</strong>}</div><div className="scoring-player-grid">{defenders.map((player) => <ScoringPlayerCard player={player} key={player._id} selected={tacklerId === player._id} onClick={() => { setTacklerId(player._id); setAssistIds((current) => current.filter((value) => value !== player._id)); }} />)}</div><div className="support-heading"><h3>Supporting defenders</h3><p>Optional. Tap any assisting players.</p></div><div className="scoring-player-grid compact">{defenders.filter((player) => player._id !== tacklerId).map((player) => <ScoringPlayerCard player={player} key={player._id} secondary={assistIds.includes(player._id)} onClick={() => setAssistIds((current) => current.includes(player._id) ? current.filter((value) => value !== player._id) : [...current, player._id])} />)}</div></section>}

          {mode === 'substitution' && <section className="scoring-section result-panel"><div className="scoring-section-heading"><div><h2>Player substitution</h2><p>Choose an on-court player to replace with a registered substitute.</p></div></div><div className="technical-team-choice">{[match.teamA, match.teamB].map((team) => <button className={substitutionTeam === team._id ? 'active' : ''} type="button" key={team._id} onClick={() => { setSubstitutionTeam(team._id); setOutgoingPlayerId(''); setIncomingPlayerId(''); }}>{team.shortName}</button>)}</div><div className="support-heading"><h3>Player out</h3><p>Choose a current on-court player.</p></div><div className="scoring-player-grid compact">{activePlayers(substitutionSide).map((player) => <ScoringPlayerCard player={player} key={player._id} selected={outgoingPlayerId === player._id} onClick={() => setOutgoingPlayerId(player._id)} />)}</div><div className="support-heading"><h3>Player in</h3><p>Only unused registered substitutes can enter.</p></div><div className="scoring-player-grid compact">{eligibleSubstitutes.map((player) => <ScoringPlayerCard player={player} key={player._id} selected={incomingPlayerId === player._id} onClick={() => setIncomingPlayerId(player._id)} />)}</div>{!eligibleSubstitutes.length && <p className="inline-form-error">No eligible substitutes remain for this team.</p>}</section>}

          {mode === 'technical' && <section className="scoring-section result-panel"><div className="scoring-section-heading"><div><h2>Technical point</h2><p>Select the team and record the official reason.</p></div></div><div className="technical-team-choice">{[match.teamA, match.teamB].map((team) => <button className={technicalTeam === team._id ? 'active' : ''} type="button" key={team._id} onClick={() => setTechnicalTeam(team._id)}>{team.shortName}</button>)}</div><label className="technical-reason"><span>Reason</span><select value={technicalReason} onChange={(event) => setTechnicalReason(event.target.value)}><option value="">Select reason</option><option>Late entry</option><option>Rule violation</option><option>Official decision</option><option>Other</option></select></label></section>}

          {mode === 'correction' && <section className="scoring-section correction-panel"><div className="scoring-section-heading"><div><h2>Official score correction</h2><p>This creates a permanent audit event. A reason is required.</p></div><strong>CONFIRM REQUIRED</strong></div><div className="technical-team-choice">{[match.teamA, match.teamB].map((team) => <button className={correctionTeam === team._id ? 'active' : ''} type="button" key={team._id} onClick={() => setCorrectionTeam(team._id)}>{team.shortName}</button>)}</div><label className="technical-reason"><span>Adjustment</span><select value={correctionAmount} onChange={(event) => setCorrectionAmount(Number(event.target.value))}><option value={1}>+1 point</option><option value={2}>+2 points</option><option value={-1}>-1 point</option><option value={-2}>-2 points</option></select></label><label className="technical-reason"><span>Reason</span><input value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} maxLength={160} placeholder="Referee decision or recorded-score error" /></label></section>}

          {mode && <div className="review-action-bar"><button type="button" onClick={prepareAction} disabled={submitting}>{mode === 'substitution' ? 'Review substitution' : mode === 'empty' ? 'Review empty raid' : 'Review scoring action'}<i className="bi bi-arrow-right" /></button></div>}

          <section className="last-event"><div><span>Latest action</span><h2>{lastEvent?.description ?? 'No scoring action recorded in this session'}</h2>{lastEvent && <p>{lastEvent.type.replaceAll('_', ' ')} - {lastEvent.teamAPointsChange >= 0 ? '+' : ''}{lastEvent.teamAPointsChange} / {lastEvent.teamBPointsChange >= 0 ? '+' : ''}{lastEvent.teamBPointsChange}</p>}</div><i className="bi bi-clock-history" aria-hidden="true" /></section>
        </div>
      )}

      {isLive && <nav className="scoring-bottom-actions" aria-label="Scoring utilities"><button type="button" onClick={resetSelection} disabled={!canScore}><i className="bi bi-x-circle" />Reset</button><button type="button" onClick={load}><i className="bi bi-arrow-clockwise" />Refresh</button><button className="undo-action" type="button" onClick={openUndoConfirmation} disabled={!canScore || !lastEvent || submitting}><i className="bi bi-arrow-counterclockwise" />Undo</button>{admin.role === 'SUPER_ADMIN' && <Link to={`/admin/matches/${matchId}/audit`}><i className="bi bi-clock-history" />Audit</Link>}</nav>}
      <ScoringConfirmSheet preview={preview} submitting={submitting} onConfirm={confirmAction} onCancel={() => { setPreview(null); setPendingAction(null); }} />
    </section>
  );
}
