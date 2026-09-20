// Translates provider-specific claims into one fixed internal shape.
//
// This is the only file that knows what Keycloak's claims are called.
// Everything downstream — require-scope.js, ownership.js, every handler —
// reads `subject`, `kind` and `scopes`, so moving to a different
// authorisation server is a change to this file and nothing else.

// A client-credentials token has no user behind it. Keycloak marks one in
// two ways, and both are checked because which one is present depends on
// the version and on whether the client mapper is enabled:
//
//   * a `client_id` / `clientId` claim, emitted for service accounts
//   * a `preferred_username` of the form `service-account-<clientId>`
//
// `sub === azp` is NOT a usable test on Keycloak: `azp` is the client that
// the token was issued to, which is set for user tokens as well, while
// `sub` is the service-account *user* id. They never match.
//
// Verify this against a real token before relying on it. Issue one through
// Client Credentials against the badminton-job client, decode the payload,
// and confirm which of these claims it actually carries.
function kindOf(claims) {
  if (claims.client_id || claims.clientId) {
    return "service";
  }

  if (String(claims.preferred_username ?? "").startsWith("service-account-")) {
    return "service";
  }

  return "user";
}

function buildPrincipal(claims) {
  return {
    subject: claims.sub,
    kind: kindOf(claims),

    // Keycloak issues `scope` as one space-separated string, not an array.
    scopes: String(claims.scope ?? "")
      .split(" ")
      .filter(Boolean),

    tokenId: claims.jti
  };
}

module.exports = {
  buildPrincipal,
  kindOf
};
