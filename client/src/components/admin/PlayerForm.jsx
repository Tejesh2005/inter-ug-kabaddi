import { useEffect, useState } from 'react';

const blankPlayer = {
  name: '', jerseyNumber: '', role: 'Raider', optionalPosition: '', photo: '', isCaptain: false, isViceCaptain: false,
};
const positions = ['Left Corner', 'Right Corner', 'Left Cover', 'Right Cover', 'Left In', 'Right In', 'Centre'];

export default function PlayerForm({ player, teamId, onSave, onCancel, saving }) {
  const [form, setForm] = useState(blankPlayer);

  useEffect(() => setForm(player ? { ...blankPlayer, ...player } : blankPlayer), [player]);
  const change = (event) => {
    const { name, value, checked, type } = event.target;
    setForm((current) => {
      const next = { ...current, [name]: type === 'checkbox' ? checked : value };
      if (name === 'isCaptain' && checked) next.isViceCaptain = false;
      if (name === 'isViceCaptain' && checked) next.isCaptain = false;
      return next;
    });
  };
  const submit = (event) => {
    event.preventDefault();
    onSave({ ...form, teamId, jerseyNumber: Number(form.jerseyNumber), optionalPosition: form.optionalPosition || undefined });
  };

  return (
    <form className="management-form" onSubmit={submit}>
      <div className="form-section-title"><span>{player ? 'Edit player' : 'Add player'}</span><button type="button" onClick={onCancel} aria-label="Close form"><i className="bi bi-x-lg" /></button></div>
      <div className="field-grid">
        <label>Player name<input name="name" value={form.name} onChange={change} required maxLength="100" /></label>
        <label>Jersey number<input name="jerseyNumber" type="number" inputMode="numeric" min="0" max="999" value={form.jerseyNumber} onChange={change} required /></label>
        <label>Role<select name="role" value={form.role} onChange={change}><option>Raider</option><option>Defender</option><option>All-Rounder</option></select></label>
        <label>Position <span>(optional)</span><select name="optionalPosition" value={form.optionalPosition} onChange={change}><option value="">Not assigned</option>{positions.map((position) => <option key={position}>{position}</option>)}</select></label>
        <label className="wide-field">Photo URL <span>(optional)</span><input name="photo" type="url" inputMode="url" value={form.photo} onChange={change} placeholder="https://…" /></label>
      </div>
      <div className="leadership-options">
        <label><input type="checkbox" name="isCaptain" checked={form.isCaptain} onChange={change} /><span><strong>Captain</strong><small>Team leader</small></span></label>
        <label><input type="checkbox" name="isViceCaptain" checked={form.isViceCaptain} onChange={change} /><span><strong>Vice captain</strong><small>Deputy leader</small></span></label>
      </div>
      <div className="form-actions"><button className="secondary-action" type="button" onClick={onCancel}>Cancel</button><button className="primary-action" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save player'}</button></div>
    </form>
  );
}
