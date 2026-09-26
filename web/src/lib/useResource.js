// A.5 — the transitions between the four states, in one place.
//
// Written once rather than in each view, because the rule that makes the
// difference is easy to get subtly wrong: a failed *refresh* must not throw
// away data the user is already reading. It keeps the content and marks it
// stale. Only a failure with nothing to fall back on is the error state.

import { useCallback, useEffect, useRef, useState } from "react";

import { content, empty, failed, loading } from "./view-state";

/**
 * @param fetcher  async (key) => data, calling into services/api.js
 * @param key      identifies what is being shown — an id from the URL, say.
 *                 A primitive rather than a dependency array: when it
 *                 changes, the view is showing a different thing and goes
 *                 back to loading.
 * @param options  collection: true when an empty result is the empty state
 */
export function useResource(fetcher, key = "", { collection = false } = {}) {
  const [state, setState] = useState(loading());

  // The fetcher closes over props and is a new function on every render, so
  // it is held in a ref rather than being a dependency — otherwise every
  // render would look like a reason to fetch again.
  const fetcherRef = useRef(fetcher);

  // Guards against a slow request landing after the key has already changed
  // and overwriting the newer screen's data.
  const generation = useRef(0);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  // Showing a different thing than a moment ago: drop to loading now, during
  // render, rather than letting one frame of the previous booking's details
  // appear under the new booking's heading.
  const [shownKey, setShownKey] = useState(key);

  if (key !== shownKey) {
    setShownKey(key);
    setState(loading());
  }

  const load = useCallback(
    async ({ background = false } = {}) => {
      const mine = ++generation.current;

      // A manual retry starts the wait over visibly. A background refresh
      // does not: there is data on screen, and blanking it every poll cycle
      // is how a working list turns into a flicker.
      if (!background) {
        setState(loading());
      }

      try {
        const data = await fetcherRef.current(key);

        if (mine !== generation.current) {
          return;
        }

        setState(
          collection && Array.isArray(data) && data.length === 0
            ? empty()
            : content(data)
        );
      } catch (problem) {
        if (mine !== generation.current) {
          return;
        }

        // The decision is made against the state itself: if there is content
        // on screen and this was a background refresh, keep it and mark it
        // stale. Anything else has nothing to fall back on and is an error.
        setState((previous) =>
          background && previous.kind === "content"
            ? content(previous.data, {
                fetchedAt: previous.fetchedAt,
                stale: true,
                lastAttempt: new Date(),
              })
            : failed(problem)
        );
      }
    },
    [collection, key]
  );

  useEffect(() => {
    // Background, because the loading state is already set — on mount by the
    // initial value, on a key change by the adjustment above. Setting it
    // again here would be a synchronous state write inside an effect.
    load({ background: true });
  }, [load]);

  return {
    state,

    // The manual retry control the error state must offer.
    retry: () => load(),

    // Re-reads without dropping to the loading state. This is what the
    // polling in A.7 will call, and what makes `stale` mean something.
    refresh: () => load({ background: true }),
  };
}
