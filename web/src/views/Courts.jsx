import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getCourts } from "../services/api";
import { useAuth } from "../auth/AuthContext";

export default function Courts() {
  const { login } = useAuth();

  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) {
    return (
      <main>
        <h1>Badminton Courts</h1>
        <p>Loading courts...</p>
      </main>
    );
  }

  if (error) {
    if (error.status === 401) {
      return (
        <main>
          <h1>Badminton Courts</h1>

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
          <h1>Badminton Courts</h1>

          <p>
            You are signed in, but you do not have permission
            to view the courts.
          </p>
        </main>
      );
    }

    if (error.status === 404) {
      return (
        <main>
          <h1>Badminton Courts</h1>

          <p>
            The requested courts could not be found.
          </p>

          <button onClick={loadCourts}>
            Retry
          </button>
        </main>
      );
    }

    return (
      <main>
        <h1>Badminton Courts</h1>

        <p>
          We could not load the courts right now.
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
        <h1>Badminton Courts</h1>

        <p>No courts are currently available.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Badminton Courts</h1>

      {courts.map((court) => (
        <article key={court.id}>
          <h2>{court.name}</h2>

          <p>Status: {court.status}</p>

          <Link to={`/courts/${court.id}`}>
            View court
          </Link>
        </article>
      ))}
    </main>
  );
}
