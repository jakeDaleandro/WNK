import { useEffect, useState } from "react";
import {
  doc,
  onSnapshot,
  type DocumentReference,
  type Query,
} from "firebase/firestore";
import { db } from "./firebase";

interface State<T> {
  data: T;
  loading: boolean;
  error: Error | null;
}

/** Live query subscription. Pass `null` to skip. `key` must change whenever the query changes. */
export function useCollection<T>(query: Query | null, key: string): State<T[]> {
  const [state, setState] = useState<State<T[]>>({ data: [], loading: !!query, error: null });

  useEffect(() => {
    if (!query) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      query,
      (snap) =>
        setState({
          data: snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }) as T),
          loading: false,
          error: null,
        }),
      (error) => {
        console.error(`[useCollection:${key}]`, error);
        setState({ data: [], loading: false, error });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

export function useDocument<T>(path: string | null): State<T | null> {
  const [state, setState] = useState<State<T | null>>({ data: null, loading: !!path, error: null });

  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    return onSnapshot(
      doc(db, path) as DocumentReference,
      (snap) =>
        setState({
          data: snap.exists() ? ({ id: snap.id, ...snap.data({ serverTimestamps: "estimate" }) } as T) : null,
          loading: false,
          error: null,
        }),
      (error) => setState({ data: null, loading: false, error }),
    );
  }, [path]);

  return state;
}

/** Re-renders every `intervalMs` so countdowns stay fresh. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
