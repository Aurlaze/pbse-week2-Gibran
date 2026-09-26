import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./auth/AuthContext";

import Courts from "./views/Courts";
import CourtDetail from "./views/CourtDetail";
import Bookings from "./views/Bookings";
import BookingForm from "./views/BookingForm";
import BookingDetail from "./views/BookingDetail";
import AdminCourts from "./views/AdminCourts";

function Navigation() {
  const { authenticated, login, logout } = useAuth();

  return (
    <nav>
      <Link to="/courts">Courts</Link>{" | "}
      <Link to="/bookings">My Bookings</Link>{" | "}
      <Link to="/admin/courts">Admin Courts</Link>{" | "}

      {authenticated ? (
        <button onClick={logout}>Sign out</button>
      ) : (
        <button onClick={login}>Sign in</button>
      )}
    </nav>
  );
}

function Callback() {
  const { authenticated, returnToKey } = useAuth();

  if (!authenticated) {
    return <main>Signing you in...</main>;
  }

  const returnTo =
    sessionStorage.getItem(returnToKey) || "/courts";

  sessionStorage.removeItem(returnToKey);

  return <Navigate to={returnTo} replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navigation />

        <Routes>
          <Route
            path="/callback"
            element={<Callback />}
          />

          <Route
            path="/courts"
            element={<Courts />}
          />

          <Route
            path="/courts/:courtId"
            element={<CourtDetail />}
          />

          <Route
            path="/bookings"
            element={<Bookings />}
          />

          <Route
            path="/bookings/new"
            element={<BookingForm />}
          />

          <Route
            path="/bookings/:bookingId"
            element={<BookingDetail />}
          />

          <Route
            path="/admin/courts"
            element={<AdminCourts />}
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;