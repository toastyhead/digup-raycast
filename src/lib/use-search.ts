import { useEffect, useState } from "react";
import { Filter, normalizeQuery, search, SearchHit, Settings } from "./digup";

export function useSearch(
  settings: Settings,
  query: string,
  code: boolean,
  filter: Filter,
  revision: number,
) {
  const key = JSON.stringify([settings, query, code, filter, revision]);
  const hasQuery = Boolean(normalizeQuery(query, code).query);
  const [state, setState] = useState<{
    key: string;
    hits: SearchHit[];
    loading: boolean;
    error?: string;
  }>({ key: "", hits: [], loading: false });

  useEffect(() => {
    const controller = new AbortController();
    setState({ key, hits: [], loading: hasQuery });
    if (!hasQuery) return () => controller.abort();
    const timer = setTimeout(() => {
      search(settings, query, code, filter, controller.signal).then(
        (hits) => {
          if (!controller.signal.aborted)
            setState({ key, hits, loading: false });
        },
        (error: unknown) => {
          if (!controller.signal.aborted)
            setState({
              key,
              hits: [],
              loading: false,
              error: error instanceof Error ? error.message : String(error),
            });
        },
      );
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, settings, query, code, filter, hasQuery]);

  return state.key === key ? state : { key, hits: [], loading: hasQuery };
}
