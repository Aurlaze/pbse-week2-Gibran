import { Link } from "react-router-dom";

import { getBookings } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import { useResource } from "../lib/useResource";
import { SkeletonList } from "../components/Skeleton";
import StaleNotice from "../components/StaleNotice";

const TITLE = "My Bookings";

export default function Bookings() {
  const { login } = useAuth();

  const { state, retry } = useResource(
    async () => {
      const data = await getBookings();

      return data.items ?? data;
    },
    "",
    { collection: true }
  );

  if (state.kind === "loading") {
    return (
      <main>
        <h1>{TITLE}</h1>
        <SkeletonList rows={3} label="Loading bookings" />
      </main>
    );
  }

  if (state.kind === "error") {
    const { status } = state.problem;

    if (status === 401) {
      return (
        <main>
          <h1>{TITLE}</h1>

          <p>Your session has expired. Please sign in again to continue.</p>

          <button onClick={login}>Sign in</button>
        </main>
      );
    }

    if (status === 403) {
      return (
        <main>
          <h1>{TITLE}</h1>

          <p>You are signed in, but you do not have permission to view bookings.</p>
        </main>
      );
    }

    if (status === 404) {
      return (
        <main>
          <h1>{TITLE}</h1>

          <p>Your bookings could not be found.</p>

          <button onClick={retry}>Retry</button>
        </main>
      );
    }

    return (
      <main>
        <h1>{TITLE}</h1>

        <p>We could not load your bookings right now. Nothing was changed.</p>

        <button onClick={retry}>Retry</button>
      </main>
    );
  }

  // Empty is not an error and must not read like one: the court is free,
  // the student simply has not booked it yet, and the next step is offered.
  if (state.kind === "empty") {
    return (
      <main>
        <h1>{TITLE}</h1>

        <p>You do not have any bookings yet.</p>

        <Link to="/bookings/new">Create a booking</Link>
      </main>
    );
  }

  return (
    <main>
      <h1>{TITLE}</h1>

      <StaleNotice state={state} noun="bookings" />

      <p>
        <Link to="/bookings/new">Create a booking</Link>
      </p>

      {state.data.map((booking) => (
        <article key={booking.id}>
          <h2>Booking {booking.id}</h2>

          {booking.courtId && <p>Court: {booking.courtId}</p>}
          {booking.startTime && <p>Start: {booking.startTime}</p>}
          {booking.endTime && <p>End: {booking.endTime}</p>}
          {booking.status && <p>Status: {booking.status}</p>}

          <Link to={`/bookings/${booking.id}`}>View booking</Link>
        </article>
      ))}
    </main>
  );
}
