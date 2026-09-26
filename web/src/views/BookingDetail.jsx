import { Link, useParams } from "react-router-dom";

import { getBooking } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import { useResource } from "../lib/useResource";
import { SkeletonDetail } from "../components/Skeleton";
import StaleNotice from "../components/StaleNotice";

export default function BookingDetail() {
  const { bookingId } = useParams();
  const { login } = useAuth();

  // Keyed on the id in the URL, so this screen can be copied into a second
  // tab mid-workflow and shows the same booking rather than the start page.
  const { state, retry } = useResource((id) => getBooking(id), bookingId);

  if (state.kind === "loading") {
    return (
      <main>
        <h1>Booking</h1>
        <SkeletonDetail label="Loading booking" />
      </main>
    );
  }

  if (state.kind === "error") {
    const { status } = state.problem;

    if (status === 401) {
      return (
        <main>
          <h1>Booking</h1>

          <p>Your session has expired. Please sign in again to continue.</p>

          <button onClick={login}>Sign in</button>
        </main>
      );
    }

    if (status === 403) {
      return (
        <main>
          <h1>Booking</h1>

          <p>You are signed in, but you do not have permission to view this booking.</p>

          <p>
            <Link to="/bookings">Back to bookings</Link>
          </p>
        </main>
      );
    }

    // A.3 — the service answers 404 identically for a booking that does not
    // exist and one belonging to another student. The client must not try to
    // tell them apart, and must not say "this is not yours".
    if (status === 404) {
      return (
        <main>
          <h1>Booking not found</h1>

          <p>The requested booking could not be found.</p>

          <Link to="/bookings">Back to bookings</Link>
        </main>
      );
    }

    return (
      <main>
        <h1>Booking</h1>

        <p>We could not load this booking right now. Nothing was changed.</p>

        <button onClick={retry}>Retry</button>

        <p>
          <Link to="/bookings">Back to bookings</Link>
        </p>
      </main>
    );
  }

  const booking = state.data;

  return (
    <main>
      <h1>Booking {booking.id}</h1>

      <StaleNotice state={state} noun="this booking" />

      {booking.courtId && <p>Court: {booking.courtId}</p>}
      {booking.startTime && <p>Start: {booking.startTime}</p>}
      {booking.endTime && <p>End: {booking.endTime}</p>}
      {booking.status && <p>Status: {booking.status}</p>}

      <p>
        <Link to="/bookings">Back to bookings</Link>
      </p>
    </main>
  );
}
