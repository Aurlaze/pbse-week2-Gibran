import keycloak from "../auth/keycloak";
import { Problem } from "../lib/problem";
import {
  forgetAll,
  knownVersion,
  lastBody,
  rememberVersion,
} from "../lib/etag-store";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// A.2 item 4 — a missing base URL is reported as itself, rather than as a
// fetch to "undefined/courts" that reads like a network fault.
//
// Checked here, at the first call, and NOT at module scope. Vite inlines
// import.meta.env at build time, so a module-scope `throw` on a missing
// variable becomes an unconditional throw in the bundle, and Rollup then
// treats everything downstream of it as unreachable and drops it. The
// build succeeds and ships a blank page. Worth remembering: a guard that
// runs while the bundler is looking is a guard that can delete your
// application.
function baseUrl() {
  if (!API_BASE_URL) {
    throw new Problem(
      "This application is not configured: VITE_API_BASE_URL is not set. " +
        "Copy web/.env.example to web/.env.local.",
      0
    );
  }

  return API_BASE_URL;
}

function notifySessionExpired() {
  window.dispatchEvent(new CustomEvent("auth:session-expired"));
}

/**
 * @param path     the operation's path, which is also its version key
 * @param options  fetch options, plus:
 *                 conditional: send If-None-Match and accept 304 (A.7)
 *                 ifMatch:     an ETag to write against (A.8)
 */
async function request(path, options = {}) {
  const { conditional = false, ifMatch, ...fetchOptions } = options;

  const headers = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers || {}),
  };

  // A.7 — ask whether anything changed, rather than fetching it again.
  if (conditional) {
    const known = knownVersion(path);

    if (known) {
      headers["If-None-Match"] = known;
    }
  }

  // A.8 — write only against the version the client last saw.
  if (ifMatch) {
    headers["If-Match"] = ifMatch;
  }

  if (keycloak.authenticated) {
    try {
      await keycloak.updateToken(30);

      if (keycloak.token) {
        headers.Authorization = `Bearer ${keycloak.token}`;
      }
    } catch (error) {
      console.error("Failed to refresh access token:", error);

      keycloak.clearToken();
      notifySessionExpired();

      throw new Problem("Your session has expired.", 401);
    }
  }

  const response = await fetch(`${baseUrl()}${path}`, {
    ...fetchOptions,
    headers,
  });

  // A.7 item 3 — a 304 is a successful read. The body is empty by design,
  // so the answer is what was stored the last time this representation
  // changed. Returning it here means a caller cannot tell a 304 from a 200
  // except by asking, which is the point: nothing changed.
  if (response.status === 304) {
    return {
      data: lastBody(path),
      etag: knownVersion(path),
      notModified: true,
    };
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const problem = new Problem(
      data?.title || "Request failed",
      response.status,
      data
    );

    if (response.status === 401) {
      keycloak.clearToken();
      notifySessionExpired();
    }

    throw problem;
  }

  const etag = response.headers.get("ETag");

  if (etag) {
    rememberVersion(path, etag, data);
  }

  return { data, etag, notModified: false };
}

export { Problem };

// Reads. Each returns { data, etag, notModified }: the ETag travels with
// the data because a write against it needs the version the user actually
// saw, not whatever the server holds now.
//
// `conditional: true` marks the representations a client polls. The others
// are fetched once per navigation, where an If-None-Match round trip buys
// nothing.

export function listCourts(query = "") {
  return request(`/courts${query}`, { conditional: true });
}

export function getCourt(courtId) {
  return request(`/courts/${courtId}`);
}

export function listBookings(query = "") {
  return request(`/bookings${query}`, { conditional: true });
}

export function getBooking(bookingId) {
  return request(`/bookings/${bookingId}`);
}

// Writes. Each takes the ETag of the version the client last saw, so the
// service can refuse one that would overwrite somebody else's change (A.8).

export function createBooking(body, idempotencyKey) {
  // No If-Match: this creates a booking rather than changing one, so there
  // is no previous version to write against. The idempotency key is what
  // makes a repeat safe here.
  return request("/bookings", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  });
}

export function cancelBooking(bookingId, body, etag) {
  return request(`/bookings/${bookingId}/cancellation`, {
    method: "POST",
    body: JSON.stringify(body),
    ifMatch: etag,
  });
}

export function retireCourt(courtId, body, etag) {
  return request(`/courts/${courtId}/retirement`, {
    method: "POST",
    body: JSON.stringify(body),
    ifMatch: etag,
  });
}

// Sign-out clears the cached representations along with the session: the
// next person to use this browser must not find the previous one's
// bookings sitting in memory.
export function forgetCachedVersions() {
  forgetAll();
}
