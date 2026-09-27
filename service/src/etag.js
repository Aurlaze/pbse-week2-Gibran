// A.7 / A.8 — entity tags, and the two conditional requests built on them.
//
// An ETag is an opaque version marker for one representation. The client
// sends it back in If-None-Match to ask "has this changed?" (A.7) and in
// If-Match to say "only write if it has not" (A.8).
//
// What a 304 saves is the body on the wire, not the work: this service
// still has to load the data and decide what the current version is before
// it can answer at all. A client polling every few seconds mostly receives
// an empty reply instead of a full list, which is the point.

const { createHash } = require("node:crypto");

// Derived from the representation itself, so the tag changes when, and only
// when, what the client would receive changes. Deriving it from a row's
// updated_at instead would miss a change made within the same clock tick,
// and would not notice a change in how the representation is rendered.
//
// Strong, not weak (no W/ prefix): two responses with the same tag really
// are byte-for-byte identical, which is what makes it safe for If-Match.
function computeETag(payload) {
  const digest = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("base64url")
    .slice(0, 27);

  return `"${digest}"`;
}

// If-None-Match and If-Match both carry either `*` or a comma-separated
// list. A tag may arrive with a W/ prefix — from a proxy that weakened it —
// so the comparison strips it rather than silently failing to match.
function parseTagList(header) {
  return header
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("W/") ? tag.slice(2) : tag));
}

function matches(header, etag) {
  if (!header) {
    return false;
  }

  const tags = parseTagList(header);

  return tags.includes("*") || tags.includes(etag);
}

/**
 * Sends a representation with its ETag, or 304 if the client already has
 * this version.
 *
 * Cache-Control: private, no-cache is set alongside. These responses are
 * shaped by who asked — a student's booking list is theirs alone — so a
 * shared cache must not hand one to somebody else. `no-cache` does not mean
 * "do not store"; it means "revalidate before reusing", which is exactly
 * the conversation an ETag is for.
 */
function sendRepresentation(req, res, payload) {
  const etag = computeETag(payload);

  res.set("ETag", etag);
  res.set("Cache-Control", "private, no-cache");

  if (matches(req.get("If-None-Match"), etag)) {
    // 304 carries no body. The ETag is repeated because the client is
    // allowed to update what it holds from this response.
    return res.status(304).end();
  }

  return res.status(200).json(payload);
}

module.exports = { computeETag, matches, sendRepresentation };
