// A.5, loading state — skeleton rows with the layout already formed.
//
// The point is not decoration. A blank screen gives the user nothing to
// judge progress by, so they reload and start the wait over; a shape that
// matches what is coming tells them the screen is working and roughly what
// will appear.

export function SkeletonList({ rows = 3, label = "Loading" }) {
  return (
    <div aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, row) => (
        <article key={row} className="skeleton-card">
          <div className="skeleton-line skeleton-title" />
          <div className="skeleton-line skeleton-meta" />
          <div className="skeleton-line skeleton-action" />
        </article>
      ))}
    </div>
  );
}

export function SkeletonDetail({ label = "Loading" }) {
  return (
    <div aria-busy="true" aria-label={label}>
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line skeleton-meta" />
      <div className="skeleton-line skeleton-meta" />
      <div className="skeleton-line skeleton-action" />
    </div>
  );
}
