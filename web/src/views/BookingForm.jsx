import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { createBooking, listCourts } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import { useResource } from "../lib/useResource";
import { SkeletonDetail } from "../components/Skeleton";
import Field from "../components/Field";

// A datetime-local input gives "2026-09-27T14:30" — no seconds, no offset.
// The contract wants RFC 3339, so the browser's own zone is applied here.
// Sending the raw value would be refused by the service for a reason the
// user cannot see and did not cause.
function toRfc3339(localValue) {
  if (!localValue) {
    return null;
  }

  const parsed = new Date(localValue);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

// A.6 item 2 — this is user experience, and it guarantees nothing. Every
// rule below is enforced again by the service, which is the only place a
// rule actually holds. The value here is that the user finds out now
// rather than after a round trip.
function checkLocally({ courtId, startTime, endTime }) {
  const errors = {};

  if (!courtId) {
    errors.courtId = "Choose a court";
  }

  if (!startTime) {
    errors.startTime = "Give a start date and time";
  }

  if (!endTime) {
    errors.endTime = "Give an end date and time";
  }

  if (startTime && endTime && Date.parse(endTime) <= Date.parse(startTime)) {
    errors.endTime = "The end time must be after the start time";
  }

  return errors;
}

export default function BookingForm() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [courtId, setCourtId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [localErrors, setLocalErrors] = useState({});
  const [problem, setProblem] = useState(null);

  // The court list fills the picker. Free text would invite a 422 for a
  // court that does not exist, when the set of courts is knowable.
  const courts = useResource(listCourts, "", {
    collection: true,
    select: (body) => body.items ?? body,
  });

  // A.6 item 3 — the idempotency key is the guarantee; the disabled button
  // is only prevention. The key identifies *this booking attempt*, so it is
  // generated once and kept: pressing submit again after a failure is the
  // same intent and must not create a second booking. Editing any field
  // makes it a different request, and the service answers a reused key
  // carrying a different body with 409, so the key is renewed below.
  const idempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => {
    idempotencyKey.current = crypto.randomUUID();
  }, [courtId, startTime, endTime]);

  async function handleSubmit(event) {
    event.preventDefault();

    const found = checkLocally({ courtId, startTime, endTime });

    setLocalErrors(found);
    setProblem(null);

    if (Object.keys(found).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const { data: booking } = await createBooking(
        {
          courtId,
          startTime: toRfc3339(startTime),
          endTime: toRfc3339(endTime),
        },
        idempotencyKey.current
      );

      navigate(booking?.id ? `/bookings/${booking.id}` : "/bookings");
    } catch (refusal) {
      setProblem(refusal);
    } finally {
      setSubmitting(false);
    }
  }

  // A.3 — a session that has run out is not a form problem.
  if (problem?.status === 401) {
    return (
      <main>
        <h1>Create a booking</h1>

        <p>Your session has expired. Please sign in again to continue.</p>

        <button onClick={login}>Sign in</button>
      </main>
    );
  }

  if (problem?.status === 403) {
    return (
      <main>
        <h1>Create a booking</h1>

        <p>Your account is not permitted to create bookings.</p>

        <p>
          <Link to="/bookings">Back to bookings</Link>
        </p>
      </main>
    );
  }

  // The message for a field: what the service said about it, or what was
  // caught here before sending. The service wins — it knows the rule.
  const reasonFor = (name) => problem?.fieldReason(name) ?? localErrors[name];

  // A refusal that names no field is about the request as a whole: an
  // overlapping slot, a retired court, an unusable pair of times. A.6 puts
  // those at the level of the form.
  const formProblem =
    problem && !problem.hasFieldReasons && ![401, 403].includes(problem.status)
      ? problem
      : null;

  return (
    <main>
      <h1>Create a booking</h1>

      {formProblem && (
        <section className="form-problem" role="alert">
          <p>{formProblem.sentence}</p>

          {formProblem.status === 404 && (
            <p>
              <Link to="/courts">Back to the court list</Link>
            </p>
          )}
        </section>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Field
          name="courtId"
          label="Court"
          error={reasonFor("courtId")}
          hint={courts.state.kind === "empty" ? "No courts are available." : null}
        >
          {(props) =>
            courts.state.kind === "loading" ? (
              <SkeletonDetail label="Loading courts" />
            ) : (
              <select
                {...props}
                value={courtId}
                onChange={(event) => setCourtId(event.target.value)}
                disabled={submitting}
              >
                <option value="">Choose a court…</option>

                {courts.state.kind === "content" &&
                  courts.state.data
                    .filter((court) => court.status !== "retired")
                    .map((court) => (
                      <option key={court.id} value={court.id}>
                        {court.name}
                      </option>
                    ))}
              </select>
            )
          }
        </Field>

        {courts.state.kind === "error" && (
          <p className="field-error">
            The court list could not be loaded.{" "}
            <button type="button" onClick={courts.retry}>
              Retry
            </button>
          </p>
        )}

        <Field name="startTime" label="Start time" error={reasonFor("startTime")}>
          {(props) => (
            <input
              {...props}
              type="datetime-local"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              disabled={submitting}
            />
          )}
        </Field>

        <Field name="endTime" label="End time" error={reasonFor("endTime")}>
          {(props) => (
            <input
              {...props}
              type="datetime-local"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              disabled={submitting}
            />
          )}
        </Field>

        {/* Disabled while the request is in flight. Prevention, not the
            guarantee — the idempotency key above is the guarantee. */}
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating booking…" : "Create booking"}
        </button>
      </form>

      <p>
        <Link to="/bookings">Back to bookings</Link>
      </p>
    </main>
  );
}
