import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  getBooking,
  listCourts,
} from "../services/api";

import { useAuth } from "../auth/AuthContext";

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      dateStyle: "long",
      timeStyle: "short",
    }
  ).format(date);
}

function formatTimeRange(
  startTime,
  endTime
) {
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

  const startText =
    new Intl.DateTimeFormat(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
      }
    ).format(start);

  const endText =
    new Intl.DateTimeFormat(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
      }
    ).format(end);

  return `${startText} – ${endText}`;
}

function getCourtName(courts, courtId) {
  const court = courts.find(
    (item) => item.id === courtId
  );

  if (!court?.name) {
    return courtId || "Unknown court";
  }

  return court.name.replace(
    /^Court\s+/i,
    ""
  );
}

export default function BookingDetail() {
  const { bookingId } = useParams();
  const { login } = useAuth();

  const [booking, setBooking] =
    useState(null);

  const [courts, setCourts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  async function loadBooking() {
    try {
      setLoading(true);
      setError(null);

      const [
        bookingResult,
        courtsResult,
      ] = await Promise.all([
        getBooking(bookingId),
        listCourts(),
      ]);

      setBooking(
        bookingResult?.data ??
          bookingResult
      );

      const courtData =
        courtsResult?.data;

      setCourts(
        Array.isArray(courtData)
          ? courtData
          : courtData?.items ?? []
      );
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

        <p>
          Loading booking...
        </p>
      </main>
    );
  }

  if (error) {
    if (error.status === 401) {
      return (
        <main>
          <h1>Booking Detail</h1>

          <p>
            Your session has expired.
            Please sign in again to
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
            You are signed in, but you do
            not have permission to view
            this booking.
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
            The requested booking could
            not be found.
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
          We could not load this booking
          right now.
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
          The requested booking could
          not be found.
        </p>

        <Link to="/bookings">
          Back to bookings
        </Link>
      </main>
    );
  }

  const courtName = getCourtName(
    courts,
    booking.courtId
  );

  const canCancel =
    booking.status === "confirmed";

  return (
    <main>
      <h1>Booking Detail</h1>

      <p>
        <strong>Court:</strong>{" "}
        {courtName}
      </p>

      <p>
        <strong>Date:</strong>{" "}
        {formatDateTime(
          booking.startTime
        )}
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

      {booking.status === "cancelled" && (
        <p>
          This booking has been cancelled.
        </p>
      )}

      {canCancel && (
        <p>
          <Link
            to={`/bookings/${booking.id}/cancel`}
          >
            Cancel booking
          </Link>
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