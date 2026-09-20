# Keycloak realm

`badminton-booking-realm.json` is imported on start by
`../docker-compose.auth.yml`. It carries the scopes, the three clients, the
six test users, and refresh-token rotation with reuse detection.

## What is deliberately not in this file

**The realm's signing keys.** An exported realm normally includes its
`org.keycloak.keys.KeyProvider` components, which contain the RSA private key
Keycloak signs access tokens with, plus generated HMAC and AES secrets. Those
were removed: committing them would put a token-signing key in version
control, and anyone with the repository could then mint a token this service
accepts. Keycloak generates a fresh set on import, which is what you want —
they are per-environment values, not configuration.

**The confidential client's secret.** `badminton-job` has client
authentication on, but its secret is generated at import and read from the
Keycloak console. It belongs in a secret manager, never here.

## What is in this file, and why that is fine

The six test users have the password `password`. That is not a secret: this
realm only ever runs on `localhost` via docker-compose, and a credential that
is committed is a credential that is published. Nothing that guards anything
real is written here.
