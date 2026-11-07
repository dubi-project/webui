import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { APIError, request } from '../api';
import type { ManagementResponse } from '../api';

export const SessionExpired = createContext<() => void>(() => {});
export interface Resource<T> { response: ManagementResponse<T> | null; loading: boolean; error: Error | null; reload: () => void }
export function useResource<T>(path: string | null, revision: number): Resource<T> {
  const expire = useContext(SessionExpired);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ path: string | null; response: ManagementResponse<T> | null; loading: boolean; error: Error | null }>({ path, response: null, loading: !!path, error: null });
  const sequence = useRef(0);
  const reload = useCallback(() => setRetry(value => value + 1), []);
  useEffect(() => {
    const current = ++sequence.current;
    const controller = new AbortController();
    if (!path) { setState({ path, response: null, loading: false, error: null }); return; }
    setState(previous => ({ path, response: previous.path === path ? previous.response : null, loading: true, error: null }));
    void request<ManagementResponse<T>>(path, { signal: controller.signal }).then(response => {
      if (!response?.meta || typeof response.meta.complete !== 'boolean' || response.data === undefined) throw new Error('管理接口返回了无法识别的数据。');
      if (sequence.current === current && !controller.signal.aborted) setState({ path, response, loading: false, error: null });
    }).catch((error: unknown) => {
      if (sequence.current !== current || controller.signal.aborted) return;
      if (error instanceof APIError && error.status === 401) { expire(); return; }
      const discard = error instanceof APIError && (error.status === 403 || error.status === 404);
      setState(previous => ({ path, response: !discard && previous.path === path ? previous.response : null, loading: false, error: error instanceof Error ? error : new Error('读取失败。') }));
    });
    return () => controller.abort();
  }, [path, revision, retry, expire]);
  // Never render the previous filter's result while a new request is being scheduled.
  return state.path === path ? { ...state, reload } : { response: null, error: null, loading: !!path, reload };
}
export function adminPath(path: string, query: Record<string, string> = {}) {
  const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== ''));
  return `/api/v1/admin/${path}${params.size ? `?${params}` : ''}`;
}
export const segment = encodeURIComponent;
