const copy = {
  loading: ['CHECKING', 'Connecting to the tournament server…', 'bi-arrow-repeat'],
  ready: ['API READY', 'Frontend and backend are communicating.', 'bi-check2-circle'],
  error: ['API OFFLINE', 'Start the backend, then try again.', 'bi-exclamation-triangle'],
};

export default function SystemStatus({ state, health, onRetry }) {
  const [label, message, icon] = copy[state];
  const database = health?.data?.database ?? 'waiting';

  return (
    <section className={`status-card status-${state}`} aria-live="polite">
      <div className="status-heading">
        <i className={`bi ${icon}`} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <h2>{message}</h2>
      <div className="status-detail">
        <span>Database</span>
        <strong>{database}</strong>
      </div>
      {state === 'error' && (
        <button className="btn retry-button" type="button" onClick={onRetry}>Retry connection</button>
      )}
    </section>
  );
}
