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

  async function login() {
    await keycloak.login({
      redirectUri: CALLBACK_URL,
    });
  }

  async function logout() {
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