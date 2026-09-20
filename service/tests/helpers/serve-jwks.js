// Runs the test JWKS server as its own process, and mints one token for a
// caller that lives outside Node — the contract suite and the curl steps in
// CI, which need an Authorization header now that every /v1 operation
// requires one.
//
//   node tests/helpers/serve-jwks.js --port 9999 --token-out /tmp/token.txt
//
// The process stays alive serving the public key, because the service
// fetches the JWKS lazily on the first request it has to verify.

const fs = require("node:fs");
const { startJwksServer, tokenFor } = require("./tokens");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

// Everything the contract suite needs to reach every documented operation.
// A real client would never hold all five at once; this token exists only so
// the fuzzer can exercise the whole document.
const ALL_SCOPES = [
  "courts:read",
  "courts:write",
  "bookings:read",
  "bookings:write",
  "bookings:fulfil"
];

async function main() {
  const port = Number(arg("port", 9999));
  const tokenOut = arg("token-out");
  const subject = arg("subject", "contract-runner");

  const jwks = await startJwksServer(port);
  console.log(`test JWKS on ${jwks.url}`);

  if (tokenOut) {
    // Long enough to outlive a full schemathesis run; this key is thrown
    // away when the job ends, so the lifetime costs nothing.
    const token = await tokenFor(subject, ALL_SCOPES, { expiresIn: "2h" });
    fs.writeFileSync(tokenOut, token, "utf8");
    console.log(`token for ${subject} written to ${tokenOut}`);
  }

  // Nothing else to do; the server keeps the event loop alive.
}

main().catch((err) => {
  console.error("failed to start the test JWKS server:", err.message);
  process.exit(1);
});
