import Keycloak from "keycloak-js";

export const REQUESTED_SCOPES =
  "openid profile email roles courts:read courts:write bookings:write";

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL,
  realm: "badminton-booking",
  clientId: "badminton-student-web",
});

export default keycloak;