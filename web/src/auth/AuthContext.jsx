import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import keycloak, { REQUESTED_SCOPES } from "./keycloak";
import { forgetAll } from "../lib/etag-store";

const AuthContext = createContext(null);

const CALLBACK_URL = `${window.location.origin}/callback`;
const RETURN_TO_KEY = "a3-return-to";

function getCurrentLocation() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

// The scopes carried by the current access token. Used only to decide what
// the navigation offers (A.2 item 2). It is user experience, never access
// control: this runs in the browser, where it can be edited or skipped
// entirely. Every one of these operations is refused again by the service.
function currentScopes() {
  const scope = keycloak.tokenParsed?.scope;

  return typeof scope === "string" ? scope.split(" ") : [];
}

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [scopes, setScopes] = useState([]);

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) {
      return;
    }

    initialized.current = true;

    async function initialize() {
      try {
        const isAuthenticated = await keycloak.init({
          onLoad: "check-sso",
          pkceMethod: "S256",
          checkLoginIframe: false,
          redirectUri: CALLBACK_URL,
          scope: REQUESTED_SCOPES,
        });

        setAuthenticated(isAuthenticated);
        setScopes(isAuthenticated ? currentScopes() : []);
      } catch (error) {
        console.error("Keycloak initialization failed:", error);
        setAuthenticated(false);
      } finally {
        setInitializing(false);
      }
    }

    initialize();
  }, []);

  useEffect(() => {
    function handleSessionExpired() {
      sessionStorage.setItem(
        RETURN_TO_KEY,
        getCurrentLocation()
      );

      forgetAll();
      keycloak.clearToken();
      setAuthenticated(false);
      setScopes([]);
    }

    window.addEventListener(
      "auth:session-expired",
      handleSessionExpired
    );

    return () => {
      window.removeEventListener(
        "auth:session-expired",
        handleSessionExpired
      );
    };
  }, []);

  async function login() {
    sessionStorage.setItem(
      RETURN_TO_KEY,
      getCurrentLocation()
    );

    await keycloak.login({
      redirectUri: CALLBACK_URL,
      scope: REQUESTED_SCOPES,
    });
  }

  async function logout() {
    sessionStorage.removeItem(RETURN_TO_KEY);

    // The cached representations go with the session. The next person to
    // use this browser must not find the previous one's bookings in memory.
    forgetAll();

    keycloak.clearToken();
    setAuthenticated(false);
    setScopes([]);

    await keycloak.logout({
      redirectUri: `${window.location.origin}/courts`,
    });
  }

  const value = {
    keycloak,
    authenticated,
    initializing,
    login,
    logout,
    scopes,
    hasScope: (scope) => scopes.includes(scope),
    returnToKey: RETURN_TO_KEY,
  };

  if (initializing) {
    return <main>Loading session...</main>;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}