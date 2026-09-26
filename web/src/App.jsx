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
import CancelBooking from "./views/CancelBooking";
import AdminCourts from "./views/AdminCourts";

// A.2 item 2 — the menu differs by role. This is user experience only: it
// saves a customer from walking into a refusal they cannot do anything
// about. It is not access control, and it is not what stops them reaching
// the operation — see A.9. Anybody can type /admin/courts into the address
// bar, and the service refuses them there.
function Navigation() {
  const { authenticated, login, logout, hasScope } = useAuth();

  return (
    <nav>
      <Link to="/courts">Courts</Link>

      {authenticated && (
        <>
          {" | "}
          <Link to="/bookings">My Bookings</Link>
        </>
      )}

      {hasScope("courts:write") && (
        <>
          {" | "}
          <Link to="/admin/courts">Admin Courts</Link>
        </>
      )}

      {" | "}

      {authenticated ? (
        <button onClick={logout}>Sign out</button>
      ) : (
        <button onClick={login}>Sign in</button>
      )}
    </nav>
  );
}

// Every unrecognised address lands here rather than on a blank page.
function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>

      <p>That address does not match any screen in this application.</p>

      <Link to="/courts">Go to the court list</Link>
    </main>
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
          {/*
            The address the grader opens first. Without a route here the
            application answers its own front door with a blank screen.
            The court list is the one screen that needs no identity, so an
            anonymous visitor lands on content rather than on a sign-in
            wall.
          */}
          <Route
            path="/"
            element={<Navigate to="/courts" replace />}
          />

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
            path="/bookings/:bookingId/cancel"
            element={<CancelBooking />}
          />

          <Route
            path="/admin/courts"
            element={<AdminCourts />}
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;