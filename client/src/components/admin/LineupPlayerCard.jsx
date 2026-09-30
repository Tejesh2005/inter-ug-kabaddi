export default function LineupPlayerCard({ player, selection, isCaptain, onSelect, onCaptain }) {
  const selected = selection !== 'none';
  return (
    <article className={`lineup-player-card ${selected ? 'selected' : ''}`}>
      <div className="lineup-player-main">
        <span className="lineup-avatar">{player.photo ? <img src={player.photo} alt="" /> : player.name.slice(0, 1)}</span>
        <span><strong>{player.name}</strong><small>#{player.jerseyNumber} · {player.role}</small></span>
      </div>
      <div className="lineup-choice" role="group" aria-label={`Squad role for ${player.name}`}>
        <button className={selection === 'starter' ? 'active' : ''} type="button" onClick={() => onSelect(player._id, 'starter')}><i className="bi bi-7-circle" />Starting</button>
        <button className={selection === 'substitute' ? 'active' : ''} type="button" onClick={() => onSelect(player._id, 'substitute')}><i className="bi bi-arrow-left-right" />Sub</button>
      </div>
      {selected && <label className="captain-choice"><input type="radio" name="captain" checked={isCaptain} onChange={() => onCaptain(player._id)} /><span><i className="bi bi-star-fill" />Captain</span></label>}
    </article>
  );
}
