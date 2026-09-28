import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listBookings, listCourts } from "../services/api";
import { useAuth } from "../auth/AuthContext";

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
  }).format(date);
}

function formatTimeRange(startTime, endTime) {
  if (!startTime || !endTime) {
    return "—";
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return `${startTime} – ${endTime}`;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function getCollectionData(result) {
  const body = result?.data;

  if (Array.isArray(body)) {
    return body;
  }

  return body?.items ?? [];
}

function getCourtLabel(court) {
  if (!court?.name) {
    return "Unknown court";
  }

  return court.name.replace(/^Court\s+/i, "");
}

export default function Bookings() {
  const { login } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [courts, setCourts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadBookings() {
    try {
      setLoading(true);
      setError(null);

      const [bookingsResult, courtsResult] = await Promise.all([
        listBookings(),
        listCourts(),
      ]);

      setBookings(getCollectionData(bookingsResult));
      setCourts(getCollectionData(courtsResult));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookings();
  }, []);

  function getCourtName(courtId) {
    const court = courts.find((item) => item.id === courtId);

    return getCourtLabel(court);
  }

  if (loading) {
    return (
      <main>
        <h1>My Bookings</h1>
        <p>Loading bookings...</p>
      </main>
    );
  }

  if (error?.status === 401) {
    return (
      <main>
        <h1>My Bookings</h1>

        <p>
          Your session has expired. Please sign in again.
        </p>

        <button type="button" onClick={login}>
          Sign in
        </button>
      </main>
    );
  }

  if (error?.status === 403) {
    return (
      <main>
        <h1>My Bookings</h1>

        <p>
          You do not have permission to view these bookings.
        </p>
      </main>
    );
  }

  if (error?.status === 404) {
    return (
      <main>
        <h1>My Bookings</h1>

        <p>
          The booking resource could not be found.
        </p>

        <button type="button" onClick={loadBookings}>
          Retry
        </button>
      </main>
    );
  }

  if (error) {
    return (
      <main>
        <h1>My Bookings</h1>

        <p>
          {error.detail ||
            error.title ||
            "We could not load your bookings."}
        </p>

        <button type="button" onClick={loadBookings}>
          Retry
        </button>
      </main>
    );
  }

  return (
    <main>
      <h1>My Bookings</h1>

      {bookings.length === 0 ? (
        <section>
          <p>You do not have any bookings yet.</p>

          <p>
            <Link to="/courts">
              Browse courts
            </Link>
          </p>
        </section>
      ) : (
        <section>
          {bookings.map((booking) => (
            <article key={booking.id}>
              <h2>Booking</h2>

              <p>
                <strong>Court:</strong>{" "}
                {getCourtName(booking.courtId)}
              </p>

              <p>
                <strong>Date:</strong>{" "}
                {formatDate(booking.startTime)}
              </p>

              <p>
                <strong>Time:</strong>{" "}
                {formatTimeRange(
                  booking.startTime,
                  booking.endTime
                )}
              </p>

              {booking.status && (
                <p>
                  <strong>Status:</strong>{" "}
                  {booking.status}
                </p>
              )}

              <p>
                <Link to={`/bookings/${booking.id}`}>
                  View booking
                </Link>
              </p>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}