import { useEffect, useState } from 'react';

const blankTeam = {
  name: '', shortName: '', departmentOrUG: '', logo: '', primaryColor: '#B8F246', secondaryColor: '#07111F', status: 'active',
};

export default function TeamForm({ team, onSave, onCancel, saving }) {
  const [form, setForm] = useState(blankTeam);

  useEffect(() => {
    setForm(team ? { ...blankTeam, ...team } : blankTeam);
  }, [team]);

  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <form className="management-form" onSubmit={submit}>
      <div className="form-section-title"><span>{team ? 'Edit team' : 'New team'}</span><button type="button" onClick={onCancel} aria-label="Close form"><i className="bi bi-x-lg" /></button></div>
      <div className="field-grid">
        <label>Team name<input name="name" value={form.name} onChange={change} required maxLength="80" /></label>
        <label>Short name<input name="shortName" value={form.shortName} onChange={change} required maxLength="12" autoCapitalize="characters" /></label>
        <label>UG / Department<input name="departmentOrUG" value={form.departmentOrUG} onChange={change} required maxLength="80" /></label>
        <label>Logo URL <span>(optional)</span><input name="logo" type="url" value={form.logo} onChange={change} inputMode="url" placeholder="https://…" /></label>
        <label>Primary color<span className="color-input"><input name="primaryColor" type="color" value={form.primaryColor} onChange={change} /><code>{form.primaryColor}</code></span></label>
        <label>Secondary color<span className="color-input"><input name="secondaryColor" type="color" value={form.secondaryColor} onChange={change} /><code>{form.secondaryColor}</code></span></label>
        <label>Status<select name="status" value={form.status} onChange={change}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
      </div>
      <div className="form-actions"><button className="secondary-action" type="button" onClick={onCancel}>Cancel</button><button className="primary-action" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save team'}</button></div>
    </form>
  );
}
