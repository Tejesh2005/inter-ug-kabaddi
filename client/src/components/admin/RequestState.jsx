export function RequestError({ message, onRetry }) {
  return (
    <div className="request-state error" role="alert">
      <i className="bi bi-exclamation-triangle" aria-hidden="true" />
      <div><strong>Couldn’t load this section</strong><p>{message}</p></div>
      {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function EmptyState({ icon = 'bi-inbox', title, message }) {
  return (
    <div className="request-state empty">
      <i className={`bi ${icon}`} aria-hidden="true" />
      <div><strong>{title}</strong><p>{message}</p></div>
    </div>
  );
}

export function LoadingState() {
  return <div className="request-state"><span className="spinner-border spinner-border-sm" aria-hidden="true" /><span>Loading…</span></div>;
}
