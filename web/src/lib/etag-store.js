// A.7 item 2 — the ETags, somewhere that outlives a re-render.
//
// A tag held in a variable inside the polling function is recreated every
// time that function is called, so it is always undefined when the next
// poll needs it, every poll sends no If-None-Match, and the service can
// never answer 304. The saving quietly never happens and nothing looks
// broken. This module lives for as long as the page does.
//
// Keyed by the request path, so /bookings and /bookings?status=confirmed
// are different representations with different versions — which is what
// they are.

const tags = new Map();
const bodies = new Map();

export function rememberVersion(key, etag, body) {
  if (!etag) {
    return;
  }

  tags.set(key, etag);

  // The body is kept beside the tag because a 304 has none. Without it the
  // client would have a successful read it could not render.
  bodies.set(key, body);
}

export function knownVersion(key) {
  return tags.get(key);
}

export function lastBody(key) {
  return bodies.get(key);
}

export function forget(key) {
  tags.delete(key);
  bodies.delete(key);
}

// Sign-out must not leave one person's data readable to the next person to
// use the browser.
export function forgetAll() {
  tags.clear();
  bodies.clear();
}
