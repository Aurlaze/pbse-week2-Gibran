import { Link } from "react-router-dom";

import { listCourts } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import { useResource } from "../lib/useResource";
import { SkeletonList } from "../components/Skeleton";
import StaleNotice from "../components/StaleNotice";

const TITLE = "Badminton Courts";

export default function Courts() {
  const { login } = useAuth();

  const { state, retry } = useResource(listCourts, "", {
    collection: true,
    select: (body) => body.items ?? body,

    // A.7 — polled, so an unchanged list costs a 304 rather than the whole
    // collection. Courts change rarely; the interval says so.
    pollMs: 30_000,
  });

  // A.5 — the view branches on the four states and nothing else. Every
  // branch below renders something; none of them can fall through to a
  // blank screen.
  if (state.kind === "loading") {
    return (
      <main>
        <h1>{TITLE}</h1>
        <SkeletonList rows={3} label="Loading courts" />
      </main>
    );
  }

  if (state.kind === "error") {
    const { status } = state.problem;

    // A.3 — three different situations, three different answers.
    if (status === 401) {
      return (
        <main>
          <h1>{TITLE}</h1>

          <p>Your session has expired. Please sign in again to continue.</p>

          <button onClick={login}>Sign in</button>
        </main>
      );
    }

    if (status === 403) {
      return (
        <main>
          <h1>{TITLE}</h1>

          <p>You are signed in, but you do not have permission to view the courts.</p>
        </main>
      );
    }

    if (status === 404) {
      return (
        <main>
          <h1>{TITLE}</h1>

          <p>The requested courts could not be found.</p>

          <button onClick={retry}>Retry</button>
        </main>
      );
    }

    return (
      <main>
        <h1>{TITLE}</h1>

        <p>We could not load the courts right now. Nothing was changed.</p>

        <button onClick={retry}>Retry</button>
      </main>
    );
  }

  if (state.kind === "empty") {
    return (
      <main>
        <h1>{TITLE}</h1>

        <p>No courts are currently available.</p>

        <button onClick={retry}>Check again</button>
      </main>
    );
  }

  return (
    <main>
      <h1>{TITLE}</h1>

      <StaleNotice state={state} noun="courts" />

      {state.data.map((court) => (
        <article key={court.id}>
          <h2>{court.name}</h2>

          <p>Status: {court.status}</p>

          <Link to={`/courts/${court.id}`}>View court</Link>
        </article>
      ))}
    </main>
  );
}
