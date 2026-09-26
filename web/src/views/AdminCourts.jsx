import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getCourts, retireCourt } from "../services/api";
import { useAuth } from "../auth/AuthContext";

export default function AdminCourts() {
  const { login } = useAuth();

  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retiringCourtId, setRetiringCourtId] = useState(null);

  async function loadCourts() {
    try {
      setLoading(true);
      setError(null);

      const data = await getCourts();
      setCourts(data.items ?? data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCourts();
  }, []);

  async function handleRetire(courtId) {
    try {
      setRetiringCourtId(courtId);
      setError(null);

      await retireCourt(courtId, {
        reason: "Retired by administrator",
      });

      await loadCourts();
    } catch (err) {
      setError(err);
    } finally {
      setRetiringCourtId(null);
    }
  }

  if (loading) {
    return (
      <main>
        <h1>Admin Court Management</h1>
        <p>Loading courts...</p>
      </main>
    );
  }

  if (error && !retiringCourtId) {
    if (error.status === 401) {
      return (
        <main>
          <h1>Admin Court Management</h1>

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
          <h1>Admin Court Management</h1>

          <p>
            You are signed in, but you do not have permission
            to manage courts.
          </p>

          <p>
            <Link to="/courts">
              Back to courts
            </Link>
          </p>
        </main>
      );
    }

    if (error.status === 404) {
      return (
        <main>
          <h1>Admin Court Management</h1>

          <p>
            The requested court management resource could
            not be found.
          </p>

          <button onClick={loadCourts}>
            Retry
          </button>
        </main>
      );
    }

    return (
      <main>
        <h1>Admin Court Management</h1>

        <p>
          We could not load the court management data right
          now.
        </p>

        <button onClick={loadCourts}>
          Retry
        </button>
      </main>
    );
  }

  if (courts.length === 0) {
    return (
      <main>
        <h1>Admin Court Management</h1>

        <p>No courts are currently available.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Admin Court Management</h1>

      {error && (
        <section>
          {error.status === 401 && (
            <>
              <p>
                Your session has expired. Please sign in
                again.
              </p>

              <button onClick={login}>
                Sign in
              </button>
            </>
          )}

          {error.status === 403 && (
            <p>
              You do not have permission to retire this
              court.
            </p>
          )}

          {error.status === 404 && (
            <p>
              The requested court could not be found.
            </p>
          )}

          {!error.status && (
            <p>
              We could not complete the court management
              operation.
            </p>
          )}
        </section>
      )}

      {courts.map((court) => (
        <article key={court.id}>
          <h2>{court.name}</h2>

          <p>
            Status: {court.status}
          </p>

          <Link to={`/courts/${court.id}`}>
            View court
          </Link>

          {court.status !== "retired" && (
            <button
              type="button"
              onClick={() => handleRetire(court.id)}
              disabled={retiringCourtId === court.id}
            >
              {retiringCourtId === court.id
                ? "Retiring..."
                : "Retire court"}
            </button>
          )}
        </article>
      ))}
    </main>
  );
}
