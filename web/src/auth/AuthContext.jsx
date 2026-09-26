import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import keycloak from "./keycloak";

const AuthContext = createContext(null);

const CALLBACK_URL = `${window.location.origin}/callback`;
const RETURN_TO_KEY = "a3-return-to";

function getCurrentLocation() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [initializing, setInitializing] = useState(true);

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
        });

        setAuthenticated(isAuthenticated);
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

      keycloak.clearToken();
      setAuthenticated(false);
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
    });
  }

  async function logout() {
    sessionStorage.removeItem(RETURN_TO_KEY);
    keycloak.clearToken();
    setAuthenticated(false);

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