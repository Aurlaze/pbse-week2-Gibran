import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCourts } from "../services/api";

export default function Courts() {
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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

    loadCourts();
  }, []);

  if (loading) {
    return <main>Loading courts...</main>;
  }

  if (error) {
    return (
      <main>
        <h1>Badminton Courts</h1>
        <p>Failed to load courts.</p>
        <button onClick={() => window.location.reload()}>
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