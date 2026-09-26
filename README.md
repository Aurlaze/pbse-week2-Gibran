# 🏸 PBSE Week 2 - Group Assignment
## Public URL: https://pbse-week2.vercel.app/v1/courts

Welcome to the repository for **Week 2 Group Assignment** in **Platform Based Software Engineering (PBSE)**.

---

## Project Overview

This repository contains the codebase and deliverables developed during Week 2 of the Platform Based Software Engineering course. The project focuses on setting up foundational platform architectures, modular component design, and collaborative software development practices.

* Badminton Court Booking System: A customer books the available court and the staff checks and confirms it on the system
* Interface: openapi.yaml (repository root)
* Deployment URL: _not deployed yet - see docs/deployment.md_
* Deploying: docs/deployment.md
* Run the mock: cd spec && npm install && npm run mock

---

## Team Members

1. Muhammad Keenan Basyir
2. Muhammad Gibran Basyir
3. Aurelio Rafif Wicaksono
4. Thomas Nadandra Aryawida

---


## Repository Structure

```text
pbse-week2-Gibran/
├── docs/                 # Documentation & assignment guidelines
├── src/                  # Main application source code
│   ├── components/       # Reusable UI/logic modules
│   ├── services/         # API & business logic
│   └── views/            # Screen / page layouts
├── public/               # Static assets (images, icons)
├── .gitignore            # Git ignore configuration
├── README.md             # Project documentation
└── package.json / requirements.txt  # Project dependencies
```

## A.1 Application Workflows

| Workflow | Screen | Role | API Operation | Calls |
|---|---|---|---|---:|
| Browse courts | Court list | Student | GET /v1/courts | 1 |
| Browse courts | Court detail | Student | GET /v1/courts/{courtId} | 1 |
| Create booking | Booking form | Student | POST /v1/bookings | 1 |
| Create booking | Booking confirmation | Student | GET /v1/bookings/{bookingId} | 1 |
| View and cancel booking | Booking list | Student | GET /v1/bookings | 1 |
| View and cancel booking | Booking detail | Student | GET /v1/bookings/{bookingId} | 1 |
| View and cancel booking | Cancellation form | Student | POST /v1/bookings/{bookingId}/cancellation | 1 |
| Manage courts | Court management list | Administrator | GET /v1/courts | 1 |
| Manage courts | Court management detail | Administrator | GET /v1/courts/{courtId} | 1 |
| Manage courts | Retirement form | Administrator | POST /v1/courts/{courtId}/retirement | 1 |

## A.3 Session Storage and Security

The browser client uses the Keycloak JavaScript adapter for authentication. Access and refresh tokens are kept in memory by the Keycloak adapter and are not stored in `localStorage` or `sessionStorage`.

The browser only uses `sessionStorage` for the temporary `a3-return-to` value. This value stores the application path that the user was viewing before authentication was required, so the application can return the user to the same screen after signing in. It is not an authentication credential.

Keeping authentication tokens in memory reduces the risk of exposing reusable tokens through persistent browser storage. The consequence is that the tokens are lost when the page is fully reloaded. The application can then use the Keycloak SSO session to check whether the user is still authenticated and obtain a new session if possible.

When the API returns `401 Unauthorized`, the browser clears the local authentication state, remembers the current location, and offers the user a sign-in action.

When the API returns `403 Forbidden`, the browser explains that the authenticated user does not have the required permission and does not send the user through the sign-in flow again.

When the API returns `404 Not Found` for a specific resource, the browser shows a generic not-found message without revealing whether the resource exists for another user.

Signing out clears the local authentication state and calls the Keycloak logout endpoint.