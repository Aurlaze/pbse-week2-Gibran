import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  cancelBooking,
  getBooking,
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

export default function CancelBooking() {
  const { bookingId } = useParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [booking, setBooking] =
    useState(null);

  const [etag, setEtag] =
    useState(null);

  const [reason, setReason] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState(null);

  async function loadBooking() {
    try {
      setLoading(true);
      setError(null);

      const result =
        await getBooking(bookingId);

      setBooking(
        result?.data ?? result
      );

      setEtag(result?.etag ?? null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBooking();
  }, [bookingId]);

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedReason =
      reason.trim();

    if (!trimmedReason) {
      setError({
        status: 400,
        title:
          "Please provide a reason for the cancellation.",
      });
      return;
    }

    if (trimmedReason.length > 500) {
      setError({
        status: 400,
        title:
          "The cancellation reason must be 500 characters or fewer.",
      });
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await cancelBooking(
        bookingId,
        {
          reason: trimmedReason,
        },
        etag
      );

      navigate(
        `/bookings/${bookingId}`,
        {
          replace: true,
        }
      );
    } catch (err) {
      /*
       * 412 means the representation changed
       * since we loaded it.
       *
       * Reload the booking so the user does not
       * cancel using an old ETag.
       */
      if (err.status === 412) {
        setError({
          status: 412,
          title:
            "This booking changed while you were viewing it. Please review it again.",
        });

        await loadBooking();
        return;
      }

      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main>
        <h1>Cancel Booking</h1>

        <p>
          Loading booking...
        </p>
      </main>
    );
  }

  if (error?.status === 401) {
    return (
      <main>
        <h1>Cancel Booking</h1>

        <p>
          Your session has expired.
          Please sign in again.
        </p>

        <button onClick={login}>
          Sign in
        </button>
      </main>
    );
  }

  if (error?.status === 403) {
    return (
      <main>
        <h1>Cancel Booking</h1>

        <p>
          You do not have permission to
          cancel this booking.
        </p>

        <Link to="/bookings">
          Back to bookings
        </Link>
      </main>
    );
  }

  if (error?.status === 404) {
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

  /*
   * If the booking is already cancelled,
   * there is nothing left to cancel.
   */
  if (booking.status === "cancelled") {
    return (
      <main>
        <h1>Booking Already Cancelled</h1>

        <p>
          This booking has already been
          cancelled.
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

        <p>
          <Link
            to={`/bookings/${booking.id}`}
          >
            View booking
          </Link>
        </p>
      </main>
    );
  }

  if (booking.status !== "confirmed") {
    return (
      <main>
        <h1>Cannot Cancel Booking</h1>

        <p>
          This booking is currently
          <strong>
            {" "}
            {booking.status}
          </strong>
          .
        </p>

        <p>
          <Link
            to={`/bookings/${booking.id}`}
          >
            Back to booking
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Cancel Booking</h1>

      <section>
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

        <p>
          <strong>Status:</strong>{" "}
          {booking.status}
        </p>
      </section>

      {error && (
        <section>
          <p>
            {error.detail ||
              error.title ||
              "We could not cancel the booking."}
          </p>
        </section>
      )}

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="reason">
            Cancellation reason
          </label>

          <br />

          <textarea
            id="reason"
            name="reason"
            value={reason}
            onChange={(event) => {
              setReason(
                event.target.value
              );
              setError(null);
            }}
            maxLength={500}
            rows={4}
            placeholder="Why are you cancelling this booking?"
            disabled={submitting}
          />

          <p>
            {reason.length}/500
          </p>
        </div>

        <button
          type="submit"
          disabled={
            submitting ||
            !reason.trim()
          }
        >
          {submitting
            ? "Cancelling..."
            : "Confirm cancellation"}
        </button>
      </form>

      <p>
        <Link
          to={`/bookings/${booking.id}`}
        >
          Keep booking
        </Link>
      </p>
    </main>
  );
}