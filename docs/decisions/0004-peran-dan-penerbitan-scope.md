# 0004. Roles Decide What Keycloak Will Issue

Status: accepted
Date: 2026-09-27
Amends: 0003, which chose scopes as the authorisation check. That choice
stands. This decision is about *issuance*, which 0003 left implicit.

## Context

Session 5 needed the court-management workflow to run end to end, and it
could not. Three things were wrong, and only the first was obvious:

1. `POST /v1/courts/{courtId}/retirement` was documented in `openapi.yaml`
   from Session 2 and never implemented. `routes/courts.js` registered two
   GETs and nothing else.

2. `courts:write` carried `include.in.token.scope: "false"` in the realm,
   so it never appeared in a token's `scope` claim at all. Since
   `requireScope("courts:write")` reads that claim, the operation would
   have refused *every* caller, administrator or not, had it existed.

3. More seriously: **nothing distinguished the users**. All six test
   accounts held only `default-roles-badminton-booking`. `admin-a` and
   `student-a` were the same person as far as the platform was concerned.
   What a caller could do followed entirely from which OAuth client they
   signed in through — `badminton-admin-web` listed `courts:write` as an
   optional scope and `badminton-student-web` did not.

The third is the one that matters. A client is not a person. Anybody who
could reach the admin client's sign-in page was an administrator, and the
"two test accounts with different roles" the assignment asks us to
demonstrate differed in name only.

## Decision

**Roles decide what the authorisation server will issue. Scopes remain what
the service checks.**

Three realm roles now exist — `student`, `staff`, `administrator` — and the
six test users hold them. Two client scopes are limited to the roles that
should be able to obtain them:

| Client scope | Limited to | Reasoning |
| :--- | :--- | :--- |
| `courts:write` | `administrator` | Retirement is terminal and affects everybody's bookings |
| `bookings:fulfil` | `administrator`, `staff` | Handling other people's bookings is a job, not a privilege of booking |
| `bookings:write` | *unrestricted* | Anybody signed in may book a court for themselves |

There is now **one web client** for everybody. What a person may do follows
from who they are, not from which sign-in page they found.

## Why this is not a reversal of 0003

0003 rejected "roles in the token instead of scopes", and that rejection
stands. The service still reads `scope` and never reads `realm_access.roles`;
`requireScope` is still the only place a scope name is written. A role is not
being used to authorise anything.

The distinction 0003 drew — a scope says what a token may *do*, a role says
who somebody *is* — is what makes this work. The cleanup job is still not a
person and still holds scopes without holding a role. A browser client can
still ask for a token narrower than the user's full authority. What changes
is that it can no longer ask for one *wider*.

## Consequences

The client requests `courts:write` for everybody and receives it only for
administrators. The court-management link is rendered only when the token
carries the scope, which is user experience and nothing more: the service
refuses the operation either way, and A.9 is what establishes that.

`badminton-admin-web` is now redundant. It is left in the realm rather than
removed, because deleting a client invalidates any session issued by it and
nothing depends on doing so before Session 7.

The client id `badminton-student-web` is now a misnomer — it is the web
client for every role. Renaming it would mean changing the realm, every
`.env.local` in the group, and the deployment's environment, for a cosmetic
gain. It is documented here instead.

**This must be verified against a running Keycloak, and has not been.** The
check is the A.9 console attack, signed in as `student-a`: the token must not
carry `courts:write`, and `POST /v1/courts/{courtId}/retirement` must answer
403. A 200 there means the realm is not withholding the scope and the service
needs its own role check as well.
