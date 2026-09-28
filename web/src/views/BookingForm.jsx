import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { createBooking, listCourts } from "../services/api";
import { useAuth } from "../auth/AuthContext";

const OPEN_HOUR = 8;
const CLOSE_HOUR = 22;

function formatHour(hour) {
  const date = new Date(2000, 0, 1, hour, 0);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toApiDateTime(dateString, hour) {
  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  const date = new Date(
    year,
    month - 1,
    day,
    hour,
    0,
    0,
    0
  );

  return date.toISOString();
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

function isSameLocalDate(dateString, date) {
  return (
    dateString === formatDateForInput(date)
  );
}

export default function BookingForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const requestedCourtId =
    searchParams.get("courtId");

  const [courts, setCourts] = useState([]);
  const [courtId, setCourtId] = useState("");

  const [bookingDate, setBookingDate] = useState(
    formatDateForInput(new Date())
  );

  const [selectedHour, setSelectedHour] =
    useState(null);

  const [now, setNow] = useState(
    new Date()
  );

  const [loadingCourts, setLoadingCourts] =
    useState(true);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] = useState(null);

  /*
   * Keep the current time updated while the user
   * has the booking page open.
   *
   * This means a slot can automatically become
   * unavailable while the page is still open.
   */
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => clearInterval(timer);
  }, []);

  /*
   * Load courts.
   *
   * If the user came from:
   *
   * /courts/{courtId}
   *
   * then requestedCourtId is used to pre-select
   * that court.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadCourts() {
      try {
        setLoadingCourts(true);
        setError(null);

        const result = await listCourts();
        const items = getCollectionData(result);

        if (cancelled) {
          return;
        }

        const availableCourts = items.filter(
          (court) =>
            court.status === "active" &&
            court.isAvailable !== false
        );

        setCourts(availableCourts);

        if (availableCourts.length > 0) {
          const requestedCourt =
            availableCourts.find(
              (court) =>
                court.id === requestedCourtId
            );

          setCourtId(
            requestedCourt?.id ||
              availableCourts[0].id
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setLoadingCourts(false);
        }
      }
    }

    loadCourts();

    return () => {
      cancelled = true;
    };
  }, [requestedCourtId]);

  /*
   * Determine which slots are unavailable.
   *
   * Rules:
   *
   * 1. A date before today -> every slot disabled.
   * 2. Today -> any slot whose START time has
   *    already passed is disabled.
   * 3. Future date -> all slots are available.
   */
  const slotAvailability = useMemo(() => {
    const selectedDate = new Date(
      `${bookingDate}T00:00:00`
    );

    if (Number.isNaN(selectedDate.getTime())) {
      return {};
    }

    const today = formatDateForInput(now);

    const selectedDateOnly =
      new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      );

    const todayOnly =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

    if (selectedDateOnly < todayOnly) {
      return Object.fromEntries(
        Array.from(
          {
            length: CLOSE_HOUR - OPEN_HOUR,
          },
          (_, index) => [
            OPEN_HOUR + index,
            false,
          ]
        )
      );
    }

    if (!isSameLocalDate(bookingDate, now)) {
      return Object.fromEntries(
        Array.from(
          {
            length: CLOSE_HOUR - OPEN_HOUR,
          },
          (_, index) => [
            OPEN_HOUR + index,
            true,
          ]
        )
      );
    }

    const result = {};

    for (
      let hour = OPEN_HOUR;
      hour < CLOSE_HOUR;
      hour += 1
    ) {
      /*
       * A slot becomes unavailable as soon as
       * its start time has passed.
       *
       * Example:
       * current time = 21:30
       *
       * 20:00–21:00 -> unavailable
       * 21:00–22:00 -> unavailable
       */
      const slotStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hour,
        0,
        0,
        0
      );

      result[hour] = slotStart > now;
    }

    return result;
  }, [bookingDate, now]);

  /*
   * If the selected slot becomes unavailable
   * while the page is open, automatically clear it.
   */
  useEffect(() => {
    if (
      selectedHour !== null &&
      slotAvailability[selectedHour] === false
    ) {
      setSelectedHour(null);
    }
  }, [selectedHour, slotAvailability]);

  function handleDateChange(event) {
    setBookingDate(event.target.value);
    setSelectedHour(null);
    setError(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!courtId) {
      setError({
        status: 400,
        title: "Please select a court.",
      });
      return;
    }

    if (!bookingDate) {
      setError({
        status: 400,
        title: "Please select a date.",
      });
      return;
    }

    if (selectedHour === null) {
      setError({
        status: 400,
        title:
          "Please select a one-hour time slot.",
      });
      return;
    }

    /*
     * Final client-side check before sending.
     *
     * The backend remains the final authority.
     */
    if (slotAvailability[selectedHour] === false) {
      setError({
        status: 400,
        title:
          "That time slot has already started. Please choose another slot.",
      });
      setSelectedHour(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const startTime = toApiDateTime(
        bookingDate,
        selectedHour
      );

      const endTime = toApiDateTime(
        bookingDate,
        selectedHour + 1
      );

      const idempotencyKey =
        crypto.randomUUID();

      const result = await createBooking(
        {
          courtId,
          startTime,
          endTime,
        },
        idempotencyKey
      );

      const booking =
        result?.data ?? result;

      if (booking?.id) {
        navigate(
          `/bookings/${booking.id}`
        );
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
          Your session has expired. Please sign in
          again.
        </p>

        <button
          type="button"
          onClick={login}
        >
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
          You do not have permission to create a
          booking.
        </p>

        <p>
          <Link to="/courts">
            Back to courts
          </Link>
        </p>
      </main>
    );
  }

  if (loadingCourts) {
    return (
      <main>
        <h1>Create Booking</h1>

        <p>Loading courts...</p>
      </main>
    );
  }

  if (error && !error.status) {
    return (
      <main>
        <h1>Create Booking</h1>

        <p>
          {error.detail ||
            error.title ||
            "We could not load the booking form."}
        </p>

        <button
          type="button"
          onClick={() =>
            window.location.reload()
          }
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <main>
      <h1>Create Booking</h1>

      {error && (
        <section>
          <p>
            {error.status === 409
              ? "This time slot is no longer available. Please choose another slot."
              : error.detail ||
                error.title ||
                "We could not create the booking."}
          </p>
        </section>
      )}

      {courts.length === 0 ? (
        <section>
          <p>
            No courts are currently available for
            booking.
          </p>

          <p>
            <Link to="/courts">
              Back to courts
            </Link>
          </p>
        </section>
      ) : (
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="courtId">
              Court
            </label>

            <select
              id="courtId"
              name="courtId"
              value={courtId}
              onChange={(event) => {
                setCourtId(
                  event.target.value
                );
                setError(null);
              }}
              disabled={loading}
            >
              {courts.map((court) => (
                <option
                  key={court.id}
                  value={court.id}
                >
                  Court{" "}
                  {getCourtLabel(court)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="bookingDate">
              Date
            </label>

            <input
              id="bookingDate"
              name="bookingDate"
              type="date"
              value={bookingDate}
              min={formatDateForInput(
                new Date()
              )}
              onChange={handleDateChange}
              disabled={loading}
            />
          </div>

          <div>
            <p>
              <strong>
                Choose a 1-hour time slot
              </strong>
            </p>

            <p>
              Opening hours: 8:00 AM – 10:00 PM
            </p>

            <div>
              {Array.from(
                {
                  length:
                    CLOSE_HOUR - OPEN_HOUR,
                },
                (_, index) =>
                  OPEN_HOUR + index
              ).map((hour) => {
                const available =
                  slotAvailability[hour] !==
                  false;

                const selected =
                  selectedHour === hour;

                return (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => {
                      if (!available) {
                        return;
                      }

                      setSelectedHour(hour);
                      setError(null);
                    }}
                    disabled={
                      loading || !available
                    }
                    aria-pressed={selected}
                    style={{
                      display: "block",
                      width: "100%",
                      marginBottom:
                        "8px",
                      padding: "10px",
                      fontWeight: selected
                        ? "bold"
                        : "normal",
                      opacity: available
                        ? 1
                        : 0.45,
                    }}
                  >
                    {formatHour(hour)} –{" "}
                    {formatHour(hour + 1)}
                    {!available
                      ? " — unavailable"
                      : ""}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedHour !== null && (
            <p>
              <strong>
                Selected:
              </strong>{" "}
              {formatHour(selectedHour)} –{" "}
              {formatHour(
                selectedHour + 1
              )}
            </p>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              !courtId ||
              !bookingDate ||
              selectedHour === null ||
              slotAvailability[
                selectedHour
              ] === false
            }
          >
            {loading
              ? "Creating booking..."
              : "Create booking"}
          </button>
        </form>
      )}

      <p>
        <Link to="/bookings">
          Back to bookings
        </Link>
      </p>
    </main>
  );
}