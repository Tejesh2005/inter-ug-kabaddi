export default function ScoringConfirmSheet({ preview, submitting, onConfirm, onCancel }) {
  if (!preview) return null;
  const pointLabel = preview.points > 0 ? `+${preview.points}` : String(preview.points);
  return (
    <div className="scoring-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onCancel(); }}>
      <section className="scoring-confirm-sheet" role="dialog" aria-modal="true" aria-labelledby="confirm-action-title">
        <div className="confirm-grip" aria-hidden="true" />
        <p>Confirm action</p>
        <h2 id="confirm-action-title">{preview.title}</h2>
        <div className="confirm-details">{preview.details.map((detail) => <div key={detail.label}><span>{detail.label}</span><strong>{detail.value}</strong></div>)}</div>
        {!preview.hidePoints && <div className={`confirm-points ${preview.danger ? 'danger' : ''}`}><span>{preview.teamName}</span><strong>{pointLabel}</strong></div>}
        <div className="confirm-actions"><button type="button" onClick={onCancel} disabled={submitting}>Cancel</button><button className={`confirm-submit ${preview.danger ? 'danger' : ''}`} type="button" onClick={onConfirm} disabled={submitting}>{submitting ? 'Applying...' : preview.buttonLabel ?? `Confirm ${pointLabel}`}</button></div>
      </section>
    </div>
  );
}
