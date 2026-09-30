import { NavLink } from 'react-router-dom';

const items = [
  ['bi-house-door', 'Home', '/'],
  ['bi-broadcast-pin', 'Live', '/matches?filter=live'],
  ['bi-calendar3', 'Matches', '/matches'],
  ['bi-bar-chart', 'Standings', '/standings'],
  ['bi-trophy', 'Stats', '/stats'],
];

export default function BottomNavigation() {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {items.map(([icon, label, path]) => path ? (
        <NavLink className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} to={path} key={label}>
          <i className={`bi ${icon}`} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ) : <span className="nav-item" aria-disabled="true" key={label}><i className={`bi ${icon}`} aria-hidden="true" /><span>{label}</span></span>)}
    </nav>
  );
}
