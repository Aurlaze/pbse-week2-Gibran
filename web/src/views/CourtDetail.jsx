import { Link } from "react-router-dom";
import { useParams } from "react-router-dom";

import { getCourt } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import { useResource } from "../lib/useResource";
import { SkeletonDetail } from "../components/Skeleton";
import StaleNotice from "../components/StaleNotice";

export default function CourtDetail() {
  const { courtId } = useParams();
  const { login } = useAuth();

  // The id comes from the URL and is the key: opening /courts/{id} in a new
  // tab loads that court, and changing the id loads the other one.
  const { state, retry } = useResource(getCourt, courtId);

  if (state.kind === "loading") {
    return (
      <main>
        <h1>Court</h1>
        <SkeletonDetail label="Loading court" />
      </main>
    );
  }

  if (state.kind === "error") {
    const { status } = state.problem;

    if (status === 401) {
      return (
        <main>
          <h1>Court</h1>

          <p>Your session has expired. Please sign in again to continue.</p>

          <button onClick={login}>Sign in</button>
        </main>
      );
    }

    if (status === 403) {
      return (
        <main>
          <h1>Court</h1>

          <p>You are signed in, but you do not have permission to view this court.</p>

          <p>
            <Link to="/courts">Back to courts</Link>
          </p>
        </main>
      );
    }

    // A.3 — "not found" and nothing more. The service answers 404 for a
    // court that does not exist and for one that is not yours, and saying
    // which would leak exactly what it is hiding.
    if (status === 404) {
      return (
        <main>
          <h1>Court not found</h1>

          <p>The requested court could not be found.</p>

          <Link to="/courts">Back to courts</Link>
        </main>
      );
    }

    return (
      <main>
        <h1>Court</h1>

        <p>We could not load this court right now. Nothing was changed.</p>

        <button onClick={retry}>Retry</button>

        <p>
          <Link to="/courts">Back to courts</Link>
        </p>
      </main>
    );
  }

  // A single object has no empty state: it is either found or it is a 404,
  // handled above. `empty` here would mean the service answered 200 with no
  // body, which the contract does not allow.
  const court = state.data;

  return (
    <main>
      <h1>{court.name}</h1>

      <StaleNotice state={state} noun="this court" />

      <p>Status: {court.status}</p>

      {court.description && <p>{court.description}</p>}

      <p>
        <Link to="/courts">Back to courts</Link>
      </p>
    </main>
  );
}
