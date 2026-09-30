import { useCallback, useEffect, useState } from 'react';
import { tournamentApi } from '../../api/management';
import PageHeader from '../../components/admin/PageHeader';
import { LoadingState, RequestError } from '../../components/admin/RequestState';

const blankTournament = {
  name: '', shortName: '', venue: '', logo: '', startDate: '', endDate: '', status: 'upcoming', format: 'league_knockout',
  settings: { matchDuration: 40, halfDuration: 20, raidTime: 30, timeoutDuration: 60, numberOfPlayersOnCourt: 7, maximumSquadSize: 12, allOutPoints: 2, normalTacklePoints: 1, superTacklePoints: 2, bonusEnabled: true, superTackleEnabled: true, doOrDieEnabled: false, superRaidEnabled: true },
  pointsSystem: { winPoints: 5, drawPoints: 3, lossPoints: 0, closeLossEnabled: false, closeLossMargin: 7, closeLossPoints: 1 },
  standingsRules: { primary: 'leaguePoints', secondary: 'scoreDifference', tertiary: 'pointsFor' },
};

const toDateInput = (value) => value ? new Date(value).toISOString().slice(0, 10) : '';
const apiMessage = (error) => error.response?.data?.message ?? 'Check your connection and try again.';

export default function TournamentPage() {
  const [form, setForm] = useState(blankTournament);
  const [tournamentId, setTournamentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const tournaments = await tournamentApi.list();
      const current = tournaments[0];
      if (current) {
        setTournamentId(current._id);
        setForm({ ...blankTournament, ...current, startDate: toDateInput(current.startDate), endDate: toDateInput(current.endDate), settings: { ...blankTournament.settings, ...current.settings }, pointsSystem: { ...blankTournament.pointsSystem, ...current.pointsSystem }, standingsRules: { ...blankTournament.standingsRules, ...current.standingsRules } });
      }
    } catch (requestError) { setError(apiMessage(requestError)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const change = (event) => {
    const { name, value, type, checked, dataset } = event.target;
    const parsed = type === 'checkbox' ? checked : type === 'number' ? Number(value) : value;
    setForm((current) => dataset.section
      ? { ...current, [dataset.section]: { ...current[dataset.section], [name]: parsed } }
      : { ...current, [name]: parsed });
  };

  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const saved = tournamentId ? await tournamentApi.update(tournamentId, form) : await tournamentApi.create(form);
      setTournamentId(saved._id); setNotice('Tournament settings saved.');
    } catch (requestError) { setError(apiMessage(requestError)); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingState />;

  return (
    <section>
      <PageHeader eyebrow="TOURNAMENT CONTROL" title="Tournament settings" description="Rules here drive scoring and standings throughout the championship." />
      {error && <RequestError message={error} onRetry={!tournamentId ? load : undefined} />}
      {notice && <div className="save-notice" role="status"><i className="bi bi-check-circle" />{notice}</div>}
      <form className="settings-form" onSubmit={save}>
        <fieldset><legend>Identity & schedule</legend><div className="field-grid">
          <label>Tournament name<input name="name" value={form.name} onChange={change} required /></label>
          <label>Short name<input name="shortName" value={form.shortName} onChange={change} required /></label>
          <label>Venue<input name="venue" value={form.venue} onChange={change} required /></label>
          <label>Logo URL <span>(optional)</span><input name="logo" type="url" value={form.logo} onChange={change} /></label>
          <label>Start date<input name="startDate" type="date" value={form.startDate} onChange={change} required /></label>
          <label>End date<input name="endDate" type="date" value={form.endDate} onChange={change} required /></label>
          <label>Format<select name="format" value={form.format} onChange={change}><option value="league">League</option><option value="knockout">Knockout</option><option value="league_knockout">League + knockout</option></select></label>
          <label>Status<select name="status" value={form.status} onChange={change}><option value="upcoming">Upcoming</option><option value="live">Live</option><option value="completed">Completed</option></select></label>
        </div></fieldset>

        <fieldset><legend>Match rules</legend><div className="field-grid compact-fields">
          {[
            ['matchDuration', 'Match duration', 'min'], ['halfDuration', 'Half duration', 'min'], ['raidTime', 'Raid time', 'sec'], ['timeoutDuration', 'Timeout', 'sec'],
            ['numberOfPlayersOnCourt', 'Players on court', ''], ['maximumSquadSize', 'Maximum squad', ''], ['allOutPoints', 'All-out points', 'pts'], ['normalTacklePoints', 'Tackle points', 'pts'], ['superTacklePoints', 'Super tackle', 'pts'],
          ].map(([name, label, unit]) => <label key={name}>{label}<span className="number-field"><input data-section="settings" name={name} type="number" min="1" value={form.settings[name]} onChange={change} required />{unit && <small>{unit}</small>}</span></label>)}
        </div><div className="switch-grid">
          {[
            ['bonusEnabled', 'Bonus'], ['superTackleEnabled', 'Super tackle'], ['doOrDieEnabled', 'Do-or-die'], ['superRaidEnabled', 'Super raid'],
          ].map(([name, label]) => <label key={name}><input data-section="settings" name={name} type="checkbox" checked={form.settings[name]} onChange={change} /><span>{label}</span></label>)}
        </div></fieldset>

        <fieldset><legend>League points</legend><div className="field-grid compact-fields">
          {[
            ['winPoints', 'Win'], ['drawPoints', 'Draw'], ['lossPoints', 'Loss'], ['closeLossMargin', 'Close-loss margin'], ['closeLossPoints', 'Close-loss points'],
          ].map(([name, label]) => <label key={name}>{label}<input data-section="pointsSystem" name={name} type="number" min="0" value={form.pointsSystem[name]} onChange={change} required /></label>)}
        </div><div className="switch-grid"><label><input data-section="pointsSystem" name="closeLossEnabled" type="checkbox" checked={form.pointsSystem.closeLossEnabled} onChange={change} /><span>Enable close-loss point</span></label></div></fieldset>

        <fieldset><legend>Standings order</legend><div className="field-grid">
          {['primary', 'secondary', 'tertiary'].map((name) => <label key={name}>{name[0].toUpperCase() + name.slice(1)} rule<select data-section="standingsRules" name={name} value={form.standingsRules[name]} onChange={change}><option value="leaguePoints">League points</option><option value="scoreDifference">Score difference</option><option value="pointsFor">Points for</option></select></label>)}
        </div></fieldset>
        <div className="sticky-save"><button className="primary-action" type="submit" disabled={saving}>{saving ? 'Saving settings…' : tournamentId ? 'Save settings' : 'Create tournament'}</button></div>
      </form>
    </section>
  );
}
