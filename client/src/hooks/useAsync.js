import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async loader and tracks { data, meta, loading, error }.
 * Re-runs when `deps` change; call `reload()` to refetch manually.
 */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: undefined, meta: undefined, loading: true, error: null });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const reqId = useRef(0);

  const run = useCallback(async ({ silent = false } = {}) => {
    const id = ++reqId.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await loaderRef.current();
      if (id === reqId.current) setState({ data: res?.data, meta: res?.meta, loading: false, error: null });
      return res;
    } catch (error) {
      if (id === reqId.current) setState((s) => ({ ...s, loading: false, error }));
      return undefined;
    }
  }, []);

  useEffect(() => { run(); }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, reload: run, setData: (fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })) };
}

export function useDebounce(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
