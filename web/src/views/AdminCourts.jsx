import { useState } from "react";
import { Link } from "react-router-dom";

import { listCourts, retireCourt } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import { useResource } from "../lib/useResource";
import { SkeletonList } from "../components/Skeleton";
import StaleNotice from "../components/StaleNotice";

const TITLE = "Court Management";

export default function AdminCourts() {
  const { login } = useAuth();

  const { state, retry, refresh } = useResource(listCourts, "", {
    collection: true,
    select: (body) => body.items ?? body,
    pollMs: 30_000,
  });

  // The action's failure is kept apart from the read's state on purpose. A
  // refused retirement says so next to the list; it does not replace the
  // list with an error screen, because the list itself loaded fine.
  const [retiring, setRetiring] = useState(null);
  const [actionProblem, setActionProblem] = useState(null);

  async function handleRetire(courtId) {
    setRetiring(courtId);
    setActionProblem(null);

    try {
      await retireCourt(courtId, { reason: "Retired by administrator" });

      // Re-read in the background: the list stays on screen while the
      // updated statuses arrive.
      await refresh();
    } catch (problem) {
      setActionProblem(problem);
    } finally {
      setRetiring(null);
    }
  }

  if (state.kind === "loading") {
    return (
      <main>
        <h1>{TITLE}</h1>
        <SkeletonList rows={4} label="Loading courts" />
      </main>
    );
  }

  if (state.kind === "error") {
    const { status } = state.problem;

    if (status === 401) {
      return (
        <main>
          <h1>{TITLE}</h1>

          <p>Your session has expired. Please sign in again to continue.</p>

          <button onClick={login}>Sign in</button>
        </main>
      );
    }

    // A.3 — explained, not redirected. Signing in again as the same person
    // grants nothing new, and sending them to sign-in would loop forever.
    if (status === 403) {
      return (
        <main>
          <h1>{TITLE}</h1>

          <p>
            Your account cannot manage courts. Court management is limited to
            administrator accounts.
          </p>

          <p>
            <Link to="/courts">Back to courts</Link>
          </p>
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

        <p>There are no courts to manage.</p>

        <button onClick={retry}>Check again</button>
      </main>
    );
  }

  return (
    <main>
      <h1>{TITLE}</h1>

      <StaleNotice state={state} noun="courts" />

      {actionProblem && (
        <section role="alert">
          {actionProblem.status === 401 && (
            <>
              <p>Your session has expired. Please sign in again.</p>

              <button onClick={login}>Sign in</button>
            </>
          )}

          {actionProblem.status === 403 && (
            <p>Your account is not permitted to retire a court.</p>
          )}

          {actionProblem.status === 404 && (
            <p>That court could not be found. It may already have been removed.</p>
          )}

          {![401, 403, 404].includes(actionProblem.status) && (
            <p>
              That court could not be retired. {actionProblem.message}
            </p>
          )}
        </section>
      )}

      {state.data.map((court) => (
        <article key={court.id}>
          <h2>{court.name}</h2>

          <p>Status: {court.status}</p>

          <Link to={`/courts/${court.id}`}>View court</Link>

          {court.status !== "retired" && (
            <button
              type="button"
              onClick={() => handleRetire(court.id)}
              disabled={retiring === court.id}
            >
              {retiring === court.id ? "Retiring…" : "Retire court"}
            </button>
          )}
        </article>
      ))}
    </main>
  );
}
