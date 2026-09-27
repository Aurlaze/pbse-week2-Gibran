// A.5 — the four states every view that shows service data can be in.
//
// The assignment declares this as a TypeScript discriminated union. This
// project is JavaScript, so the union is expressed as constructors: a view
// holds exactly one of these objects and branches on `kind`, which gives the
// same property that matters — the four states are named up front, not
// discovered one at a time as somebody suffers each missing one.
//
//   { kind: 'loading' }
//   { kind: 'empty' }
//   { kind: 'error',   problem, willRetry }
//   { kind: 'content', data, fetchedAt, stale, lastAttempt }

// A request is in flight and NO data is held. A refresh that still has last
// cycle's data to show is not loading — it stays on content, which is what
// keeps a poll from blanking the screen every few seconds.
export function loading() {
  return { kind: "loading" };
}

// The request succeeded and returned nothing. Distinct from error on
// purpose: "no bookings yet" and "we could not reach the service" are
// different facts, and a view that renders them the same way makes an
// outage look like a quiet afternoon.
export function empty() {
  return { kind: "empty" };
}

// The request failed and there is nothing to fall back on.
export function failed(problem, willRetry = false) {
  return { kind: "error", problem, willRetry };
}

// Data is available. `fetchedAt` is when it actually arrived, `stale` says a
// later refresh has failed since, and `lastAttempt` is when that failure
// happened — the three facts needed to tell the user how old what they are
// reading is.
export function content(
  data,
  { fetchedAt, stale = false, lastAttempt = null, etag = null } = {}
) {
  return {
    kind: "content",
    data,
    fetchedAt: fetchedAt ?? new Date(),
    stale,
    lastAttempt,

    // The version this data was read at. A write against it carries this
    // back in If-Match, which is what lets the service refuse a change
    // made on top of somebody else's (A.8).
    etag,
  };
}

// An empty *collection* is the empty state; an absent single object is not —
// a booking that is not there is a 404, which is an error, and conflating
// the two would show "no bookings" for a booking belonging to someone else.
export function fromCollection(items, meta) {
  return items.length === 0 ? empty() : content(items, meta);
}

function secondsAgo(moment) {
  return Math.max(0, Math.round((Date.now() - moment.getTime()) / 1000));
}

function relative(moment) {
  const seconds = secondsAgo(moment);

  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? "" : "s"} ago`;
  }

  const minutes = Math.round(seconds / 60);

  return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
}

function clockTime(moment) {
  return moment.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// The sentence A.5 asks for on stale content: when the data is from, and
// what the last attempt to refresh it did. Stale data shown without this is
// worse than an error, because an error announces its own condition and old
// data presented confidently does not.
export function describeAge(state, noun = "data") {
  if (state.kind !== "content") {
    return null;
  }

  const shown = `Showing ${noun} as of ${clockTime(state.fetchedAt)}.`;

  if (!state.stale) {
    return shown;
  }

  const attempt = state.lastAttempt
    ? ` Last attempt failed ${relative(state.lastAttempt)}.`
    : "";

  return `${shown} Reconnecting…${attempt}`;
}
