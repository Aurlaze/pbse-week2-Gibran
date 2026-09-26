import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { createBooking } from "../services/api";
import { useAuth } from "../auth/AuthContext";

export default function BookingForm() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [courtId, setCourtId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setLoading(true);
      setError(null);

      const idempotencyKey = crypto.randomUUID();

      const booking = await createBooking(
        {
          courtId,
          startTime,
          endTime,
        },
        idempotencyKey
      );

      const bookingId = booking.id;

      if (bookingId) {
        navigate(`/bookings/${bookingId}`);
      } else {
        navigate("/bookings");
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  if (error?.status === 401) {
    return (
      <main>
        <h1>Create Booking</h1>

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

  if (error?.status === 403) {
    return (
      <main>
        <h1>Create Booking</h1>

        <p>
          You are signed in, but you do not have permission
          to create a booking.
        </p>

        <p>
          <Link to="/bookings">
            Back to bookings
          </Link>
        </p>
      </main>
    );
  }

  if (error?.status === 404) {
    return (
      <main>
        <h1>Create Booking</h1>

        <p>
          The requested court or booking resource could not
          be found.
        </p>

        <p>
          <Link to="/courts">
            Back to courts
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Create Booking</h1>

      {error && (
        <section>
          <p>
            We could not create the booking right now.
          </p>

          <button
            type="button"
            onClick={() => setError(null)}
          >
            Try again
          </button>
        </section>
      )}

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="courtId">
            Court ID
          </label>

          <input
            id="courtId"
            name="courtId"
            type="text"
            value={courtId}
            onChange={(event) =>
              setCourtId(event.target.value)
            }
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="startTime">
            Start time
          </label>

          <input
            id="startTime"
            name="startTime"
            type="datetime-local"
            value={startTime}
            onChange={(event) =>
              setStartTime(event.target.value)
            }
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="endTime">
            End time
          </label>

          <input
            id="endTime"
            name="endTime"
            type="datetime-local"
            value={endTime}
            onChange={(event) =>
              setEndTime(event.target.value)
            }
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
        >
          {loading ? "Creating booking..." : "Create booking"}
        </button>
      </form>

      <p>
        <Link to="/bookings">
          Back to bookings
        </Link>
      </p>
    </main>
  );
}
