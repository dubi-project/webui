import { useContext, useEffect, useState } from 'react';
import { APIError, request } from '../api';
import type { ManagementResponse } from '../api';
import { adminPath, SessionExpired } from './resource';
export function useAdminMutation(csrf: string) {
  const expire = useContext(SessionExpired);
  return async <T,>(path: string, method: string, body: unknown): Promise<T> => {
    try { return (await request<ManagementResponse<T>>(adminPath(path), { method, headers: { 'Content-Type': 'application/json', 'X-Dubi-CSRF': csrf }, body: JSON.stringify(body) })).data; }
    catch (e) { if (e instanceof APIError && e.status === 401) expire(); throw e; }
  };
}
export function message(e: unknown) { return e instanceof Error ? e.message : '操作失败，请重试。'; }
export type TenantOption = { value: string; label: string; modules: string };
export function useTenantOptions(revision: number, enabled = true) {
  const expire = useContext(SessionExpired);
  const [data, setData] = useState<TenantOption[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => {
    const c = new AbortController(); if (!enabled) {setData([]);setLoading(false);return;} setLoading(true); setError('');
    void (async () => {
      const all: TenantOption[] = []; let cursor = '';
      do {
        const r = await request<ManagementResponse<{ items: { tenant_id: string; name: string; modules: string[] }[]; next_cursor?: string }>>(adminPath('tenants', { limit: '200', cursor }), { signal: c.signal });
        for (const t of r.data.items) all.push({ value: t.tenant_id, label: `${t.name || t.tenant_id} · ${t.tenant_id}`, modules: t.modules.join('、') || '未授权模块' });
        cursor = r.data.next_cursor ?? ''; if (all.length > 4096) throw new Error('租户列表超出支持范围。');
      } while (cursor);
      if (!c.signal.aborted) setData(all);
    })().catch(e => { if (c.signal.aborted) return; setData([]); if (e instanceof APIError && e.status === 401) expire(); setError(message(e)); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [revision, expire, enabled]);
  return { data, error, loading };
}
