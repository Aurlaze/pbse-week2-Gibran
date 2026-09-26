import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getCourt } from "../services/api";
import { useAuth } from "../auth/AuthContext";

export default function CourtDetail() {
  const { courtId } = useParams();
  const { login } = useAuth();

  const [court, setCourt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadCourt() {
    try {
      setLoading(true);
      setError(null);

      const data = await getCourt(courtId);
      setCourt(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCourt();
  }, [courtId]);

  if (loading) {
    return (
      <main>
        <h1>Court Detail</h1>
        <p>Loading court...</p>
      </main>
    );
  }

  if (error) {
    if (error.status === 401) {
      return (
        <main>
          <h1>Court Detail</h1>

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
          <h1>Court Detail</h1>

          <p>
            You are signed in, but you do not have permission
            to view this court.
          </p>

          <Link to="/courts">
            Back to courts
          </Link>
        </main>
      );
    }

    if (error.status === 404) {
      return (
        <main>
          <h1>Court not found</h1>

          <p>
            The requested court could not be found.
          </p>

          <Link to="/courts">
            Back to courts
          </Link>
        </main>
      );
    }

    return (
      <main>
        <h1>Court Detail</h1>

        <p>
          We could not load this court right now.
        </p>

        <button onClick={loadCourt}>
          Retry
        </button>

        <p>
          <Link to="/courts">
            Back to courts
          </Link>
        </p>
      </main>
    );
  }

  if (!court) {
    return (
      <main>
        <h1>Court not found</h1>

        <p>
          The requested court could not be found.
        </p>

        <Link to="/courts">
          Back to courts
        </Link>
      </main>
    );
  }

  return (
    <main>
      <h1>{court.name}</h1>

      <p>
        Status: {court.status}
      </p>

      {court.description && (
        <p>
          {court.description}
        </p>
      )}

      <p>
        <Link to="/courts">
          Back to courts
        </Link>
      </p>
    </main>
  );
}
