// A.9 — a handle for attacking this application from the browser console.
//
// The course's reference application exposes window.__kantin.token() for
// the same purpose. This is the equivalent.
//
// It gives away nothing. The access token is already in this page's memory
// and readable by any script running on this origin; naming it on `window`
// changes who can read it not at all. What it changes is how long it takes
// to demonstrate that hiding a button is not access control — which is the
// point A.9 is making.
//
// Every request sent this way is answered by the service on its own terms.
// That is the whole demonstration: the interface is not what refuses you.

import keycloak from "../auth/keycloak";

export function installConsoleHandle(baseUrl) {
  if (typeof window === "undefined") {
    return;
  }

  window.__badminton = {
    // The raw access token, for pasting into curl or another tab.
    token: () => keycloak.token ?? null,

    // The scopes it actually carries. The quickest way to see that a
    // student's token does not hold courts:write, however the interface
    // behaves.
    scopes: () =>
      typeof keycloak.tokenParsed?.scope === "string"
        ? keycloak.tokenParsed.scope.split(" ")
        : [],

    // Who the service thinks you are.
    subject: () => keycloak.tokenParsed?.sub ?? null,

    // Sends a request exactly as the application would — same base URL,
    // same Authorization header — while going nowhere near the interface.
    //
    //   await __badminton.call('POST', '/courts/crt_x/retirement',
    //     { reason: 'from the console' }, { 'If-Match': '*' })
    //
    // Signed in as a student, that must answer 403. A 200 means the
    // service accepted an operation the client was only hiding.
    call: async (method, path, body, headers = {}) => {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(keycloak.token
            ? { Authorization: `Bearer ${keycloak.token}` }
            : {}),
          ...headers,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });

      const text = await response.text();

      return {
        status: response.status,
        body: text ? JSON.parse(text) : null,
      };
    },
  };
}
