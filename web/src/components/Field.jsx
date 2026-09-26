// A.6 — one labelled input with its own error message underneath it.
//
// The message belongs on the field the service refused, not in a single red
// banner at the top of the page: a banner makes the user re-read the whole
// form to find out which box is wrong, which the service already told us.

export default function Field({
  name,
  label,
  error,
  hint,
  children,
}) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>

      {/* aria-describedby and aria-invalid are how a screen reader learns
          the same thing the red text says to everyone else. */}
      {children({
        id: name,
        name,
        "aria-invalid": error ? "true" : undefined,
        "aria-describedby": error ? errorId : hint ? hintId : undefined,
      })}

      {hint && !error && (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      )}

      {error && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
