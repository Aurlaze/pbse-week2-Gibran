import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { cancelBooking, getBooking } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import { useResource } from "../lib/useResource";
import { SkeletonDetail } from "../components/Skeleton";
import Field from "../components/Field";

const REASON_MAX_LENGTH = 500;

export default function CancelBooking() {
  const { bookingId } = useParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  // The booking is loaded rather than carried here in router state: this
  // screen has an address of its own and must work when it is opened cold.
  const { state, retry } = useResource((id) => getBooking(id), bookingId);

  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [problem, setProblem] = useState(null);

  // No idempotency key: the contract makes this operation naturally
  // idempotent. Cancelling an already-cancelled booking answers 200 with
  // the existing cancellation rather than refusing, because the end state
  // the caller asked for already holds.
  async function handleSubmit(event) {
    event.preventDefault();

    setProblem(null);

    if (reason.trim() === "") {
      setLocalError("Say why the booking is being cancelled");
      return;
    }

    setLocalError(null);
    setSubmitting(true);

    try {
      await cancelBooking(bookingId, { reason: reason.trim() });

      navigate(`/bookings/${bookingId}`);
    } catch (refusal) {
      setProblem(refusal);
    } finally {
      setSubmitting(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <main>
        <h1>Cancel booking</h1>
        <SkeletonDetail label="Loading booking" />
      </main>
    );
  }

  if (state.kind === "error" || problem?.status === 401 || problem?.status === 403) {
    const status = problem?.status ?? state.problem.status;

    if (status === 401) {
      return (
        <main>
          <h1>Cancel booking</h1>

          <p>Your session has expired. Please sign in again to continue.</p>

          <button onClick={login}>Sign in</button>
        </main>
      );
    }

    if (status === 403) {
      return (
        <main>
          <h1>Cancel booking</h1>

          <p>Your account is not permitted to cancel this booking.</p>

          <p>
            <Link to="/bookings">Back to bookings</Link>
          </p>
        </main>
      );
    }

    // A.3 — the same answer for "no such booking" and "not yours".
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
        <h1>Cancel booking</h1>

        <p>We could not load this booking right now. Nothing was changed.</p>

        <button onClick={retry}>Retry</button>
      </main>
    );
  }

  const booking = state.data;

  if (booking.status === "cancelled") {
    return (
      <main>
        <h1>Already cancelled</h1>

        <p>This booking has already been cancelled. Nothing further is needed.</p>

        <p>
          <Link to={`/bookings/${bookingId}`}>Back to the booking</Link>
        </p>
      </main>
    );
  }

  const fieldError = problem?.fieldReason("reason") ?? localError;

  // A refusal naming no field is about the request as a whole.
  const formProblem = problem && !problem.hasFieldReasons ? problem : null;

  return (
    <main>
      <h1>Cancel booking {booking.id}</h1>

      {booking.startTime && <p>Start: {booking.startTime}</p>}
      {booking.endTime && <p>End: {booking.endTime}</p>}

      {formProblem && (
        <section className="form-problem" role="alert">
          <p>{formProblem.sentence}</p>
        </section>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Field
          name="reason"
          label="Why are you cancelling?"
          error={fieldError}
          hint={`Up to ${REASON_MAX_LENGTH} characters. The court is released for others once cancelled.`}
        >
          {(props) => (
            <textarea
              {...props}
              rows={3}
              maxLength={REASON_MAX_LENGTH}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={submitting}
            />
          )}
        </Field>

        <button type="submit" disabled={submitting}>
          {submitting ? "Cancelling…" : "Cancel this booking"}
        </button>
      </form>

      <p>
        <Link to={`/bookings/${bookingId}`}>Keep the booking</Link>
      </p>
    </main>
  );
}
