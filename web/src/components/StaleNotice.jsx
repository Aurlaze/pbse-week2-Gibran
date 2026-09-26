// A.5, content state — the age marker.
//
// Rendered whenever there is content, not only when a refresh has failed:
// the time the data was fetched is part of reading it honestly. When a
// refresh *has* failed it also says so, and when it has not the sentence is
// just the timestamp.

import { describeAge } from "../lib/view-state";

export default function StaleNotice({ state, noun = "data" }) {
  const sentence = describeAge(state, noun);

  if (!sentence) {
    return null;
  }

  return (
    <p
      className={state.stale ? "age-marker age-marker-stale" : "age-marker"}
      role={state.stale ? "status" : undefined}
    >
      {sentence}
    </p>
  );
}
