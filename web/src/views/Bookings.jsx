import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getBookings } from "../services/api";
import { useAuth } from "../auth/AuthContext";

export default function Bookings() {
  const { login } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadBookings() {
    try {
      setLoading(true);
      setError(null);

      const data = await getBookings();
      setBookings(data.items ?? data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookings();
  }, []);

  if (loading) {
    return (
      <main>
        <h1>My Bookings</h1>
        <p>Loading bookings...</p>
      </main>
    );
  }

  if (error) {
    if (error.status === 401) {
      return (
        <main>
          <h1>My Bookings</h1>

          <p>
            Your session has expired. Please sign in again to
            continue.
          </p>

          <button onClick={login}>
            Sign in
          </button>
        </main>
      );
    }

    if (error.status === 403) {
      return (
        <main>
          <h1>My Bookings</h1>

          <p>
            You are signed in, but you do not have permission
            to view your bookings.
          </p>
        </main>
      );
    }

    if (error.status === 404) {
      return (
        <main>
          <h1>My Bookings</h1>

          <p>
            Your bookings could not be found.
          </p>

          <button onClick={loadBookings}>
            Retry
          </button>
        </main>
      );
    }

    return (
      <main>
        <h1>My Bookings</h1>

        <p>
          We could not load your bookings right now.
        </p>

        <button onClick={loadBookings}>
          Retry
        </button>
      </main>
    );
  }

  if (bookings.length === 0) {
    return (
      <main>
        <h1>My Bookings</h1>

        <p>You do not have any bookings yet.</p>

        <Link to="/bookings/new">
          Create a booking
        </Link>
      </main>
    );
  }

  return (
    <main>
      <h1>My Bookings</h1>

      {bookings.map((booking) => (
        <article key={booking.id}>
          <h2>
            Booking {booking.id}
          </h2>

          {booking.courtId && (
            <p>
              Court: {booking.courtId}
            </p>
          )}

          {booking.startTime && (
            <p>
              Start: {booking.startTime}
            </p>
          )}

          {booking.endTime && (
            <p>
              End: {booking.endTime}
            </p>
          )}

          {booking.status && (
            <p>
              Status: {booking.status}
            </p>
          )}

          <Link to={`/bookings/${booking.id}`}>
            View booking
          </Link>
        </article>
      ))}
    </main>
  );
}
