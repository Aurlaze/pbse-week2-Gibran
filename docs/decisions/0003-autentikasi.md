# 0003. Authentication and Access Control

## Context
We need to secure the Badminton Court Booking API. We must decide how tests will obtain tokens, identify our domain actors, and classify our clients to determine their OAuth 2.0 flows.

## Decision

### 1. Authorisation Server & Tests
We will use a **Local test key** strategy for our tests. Tests will generate their own key pair and serve its JWKS from a tiny HTTP server. `OIDC_ISSUER` and `OIDC_JWKS_URI` will point there during tests so CI needs no network and tests are fast.

### 2. Domain Actors
Based on our domain, our actors are:
* **Student:** Browses courts and creates bookings.
* **Admin:** Manages and retires courts.
* **Scheduled Job:** A backend script that automatically cancels unpaid or expired bookings.

### 3. Client Classification
| Our client | Runs on | Public/Confidential | Flow | Holds a secret? |
| :--- | :--- | :--- | :--- | :--- |
| Student Web App | User's browser | Public | Authorization Code + PKCE | No |
| Admin Web App | User's browser | Public | Authorization Code + PKCE | No |
| Cleanup Job | Team server | Confidential | Client Credentials | Yes, in a secret manager |
