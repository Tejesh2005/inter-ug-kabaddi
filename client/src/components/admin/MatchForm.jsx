import { useEffect, useMemo, useState } from 'react';

const blankMatch = {
  tournamentId: '', matchNumber: '', teamA: '', teamB: '', stage: 'League', scheduledDate: '', scheduledTime: '', venue: '',
};
const dateInput = (value) => value ? new Date(value).toISOString().slice(0, 10) : '';

export default function MatchForm({ match, tournaments, teams, onSave, onCancel, saving }) {
  const [form, setForm] = useState(blankMatch);
  const [error, setError] = useState('');
  const activeTeams = useMemo(() => teams.filter((team) => team.status === 'active'), [teams]);

  useEffect(() => {
    setForm(match ? {
      tournamentId: match.tournamentId?._id ?? match.tournamentId,
      matchNumber: match.matchNumber,
      teamA: match.teamA?._id ?? match.teamA,
      teamB: match.teamB?._id ?? match.teamB,
      stage: match.stage,
      scheduledDate: dateInput(match.scheduledDate),
      scheduledTime: match.scheduledTime,
      venue: match.venue,
    } : { ...blankMatch, tournamentId: tournaments[0]?._id ?? '' });
    setError('');
  }, [match, tournaments]);

  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = (event) => {
    event.preventDefault();
    if (form.teamA === form.teamB) { setError('Select two different teams.'); return; }
    setError('');
    onSave({ ...form, matchNumber: Number(form.matchNumber) });
  };

  return (
    <form className="management-form fixture-form" onSubmit={submit}>
      <div className="form-section-title"><span>{match ? `Edit match #${match.matchNumber}` : 'Create fixture'}</span><button type="button" onClick={onCancel} aria-label="Close form"><i className="bi bi-x-lg" /></button></div>
      {error && <div className="inline-form-error" role="alert">{error}</div>}
      <div className="field-grid">
        <label>Tournament<select name="tournamentId" value={form.tournamentId} onChange={change} required><option value="">Select tournament</option>{tournaments.map((item) => <option value={item._id} key={item._id}>{item.name}</option>)}</select></label>
        <label>Match number<input name="matchNumber" type="number" min="1" inputMode="numeric" value={form.matchNumber} onChange={change} required /></label>
        <label>Team A<select name="teamA" value={form.teamA} onChange={change} required><option value="">Select Team A</option>{activeTeams.map((team) => <option value={team._id} key={team._id}>{team.shortName} — {team.name}</option>)}</select></label>
        <label>Team B<select name="teamB" value={form.teamB} onChange={change} required><option value="">Select Team B</option>{activeTeams.map((team) => <option value={team._id} key={team._id}>{team.shortName} — {team.name}</option>)}</select></label>
        <label>Stage<select name="stage" value={form.stage} onChange={change}><option>League</option><option>Quarter Final</option><option>Semi Final</option><option>Final</option><option>Friendly</option></select></label>
        <label>Venue<input name="venue" value={form.venue} onChange={change} required maxLength="160" /></label>
        <label>Date<input name="scheduledDate" type="date" value={form.scheduledDate} onChange={change} required /></label>
        <label>Time<input name="scheduledTime" type="time" value={form.scheduledTime} onChange={change} required /></label>
      </div>
      <div className="form-actions"><button className="secondary-action" type="button" onClick={onCancel}>Cancel</button><button className="primary-action" type="submit" disabled={saving || tournaments.length === 0 || activeTeams.length < 2}>{saving ? 'Saving…' : 'Save fixture'}</button></div>
    </form>
  );
}
