import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getBooking } from "../services/api";
import { useAuth } from "../auth/AuthContext";

export default function BookingDetail() {
  const { bookingId } = useParams();
  const { login } = useAuth();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadBooking() {
    try {
      setLoading(true);
      setError(null);

      const data = await getBooking(bookingId);
      setBooking(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBooking();
  }, [bookingId]);

  if (loading) {
    return (
      <main>
        <h1>Booking Detail</h1>
        <p>Loading booking...</p>
      </main>
    );
  }

  if (error) {
    if (error.status === 401) {
      return (
        <main>
          <h1>Booking Detail</h1>

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
          <h1>Booking Detail</h1>

          <p>
            You are signed in, but you do not have permission
            to view this booking.
          </p>

          <p>
            <Link to="/bookings">
              Back to bookings
            </Link>
          </p>
        </main>
      );
    }

    if (error.status === 404) {
      return (
        <main>
          <h1>Booking not found</h1>

          <p>
            The requested booking could not be found.
          </p>

          <Link to="/bookings">
            Back to bookings
          </Link>
        </main>
      );
    }

    return (
      <main>
        <h1>Booking Detail</h1>

        <p>
          We could not load this booking right now.
        </p>

        <button onClick={loadBooking}>
          Retry
        </button>

        <p>
          <Link to="/bookings">
            Back to bookings
          </Link>
        </p>
      </main>
    );
  }

  if (!booking) {
    return (
      <main>
        <h1>Booking not found</h1>

        <p>
          The requested booking could not be found.
        </p>

        <Link to="/bookings">
          Back to bookings
        </Link>
      </main>
    );
  }

  return (
    <main>
      <h1>Booking Detail</h1>

      <p>
        Booking ID: {booking.id}
      </p>

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

      <p>
        <Link to="/bookings">
          Back to bookings
        </Link>
      </p>
    </main>
  );
}
