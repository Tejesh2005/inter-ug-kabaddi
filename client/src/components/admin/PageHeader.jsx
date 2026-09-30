export default function PageHeader({ eyebrow, title, description, action }) {
  return (
    <header className="management-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}
