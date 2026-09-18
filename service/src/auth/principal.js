function buildPrincipal(claims) {
  return {
    subject: claims.sub,
    kind: claims.kind,
    scopes: String(claims.scope ?? "")
      .split(" ")
      .filter(Boolean),
    tokenId: claims.jti,
  };
}

module.exports = {
  buildPrincipal,
};
