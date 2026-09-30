export default function ScoringPlayerCard({ player, selected = false, secondary = false, onClick, disabled = false }) {
  return (
    <button className={`scoring-player ${selected ? 'selected' : ''} ${secondary ? 'secondary-selected' : ''}`} type="button" onClick={onClick} disabled={disabled} aria-pressed={selected || secondary}>
      <span className="scoring-player-number">{player.jerseyNumber}</span>
      <span><strong>{player.name}</strong><small>{player.role}</small></span>
      <i className={`bi ${selected ? 'bi-check-circle-fill' : secondary ? 'bi-plus-circle-fill' : 'bi-circle'}`} aria-hidden="true" />
    </button>
  );
}
