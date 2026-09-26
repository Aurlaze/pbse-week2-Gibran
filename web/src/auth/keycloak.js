import Keycloak from "keycloak-js";

const keycloak = new Keycloak({
  url: "http://localhost:8080",
  realm: "badminton-booking",
  clientId: "badminton-student-web",
});

export default keycloak;