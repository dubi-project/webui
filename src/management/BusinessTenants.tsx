import { useContext, useEffect, useRef, useState } from 'react';
import BusinessTenantBar from '../components/BusinessTenantBar';
import type { BusinessTenant } from '../components/BusinessTenantBar';
import useDrawer from '../components/useDrawer';
import Icon from '../Icon';
import { APIError, request } from '../api';
import type { ManagementResponse } from '../api';
import { adminPath, SessionExpired, useResource } from './resource';
export interface TenantData { tenant_id: string; name: string; modules: string[]; storage_limit_bytes: number; used_bytes: number | null }
type Page = { items: TenantData[]; next_cursor?: string };
export const tenantView = (t: TenantData): BusinessTenant => ({ id: t.tenant_id, name: t.name || t.tenant_id, modules: t.modules });
export function useBusinessTenant(id: string, revision: number) { return useResource<TenantData>(id ? adminPath(`tenants/${encodeURIComponent(id)}`) : null, revision); }
function Detail({ tenant, onClose }: { tenant: TenantData; onClose: () => void }) {
  const drawer = useDrawer(onClose);
  return <dialog ref={drawer.dialog} className={`inspect-drawer${drawer.closing ? ' is-closing' : ''}`} onAnimationEnd={drawer.onAnimationEnd} onClick={drawer.onBackdropClick} onCancel={e => { e.preventDefault(); drawer.requestClose(); }} aria-label="业务租户详情"><header className="drawer-header"><div><div className="eyebrow">当前租户</div><h2>{tenant.name || tenant.tenant_id}</h2><p>{tenant.tenant_id}</p></div><button className="icon-button" aria-label="关闭租户详情" onClick={drawer.requestClose} autoFocus><Icon name="close"/></button></header><div className="drawer-body"><dl className="detail-fields"><dt>租户标识</dt><dd>{tenant.tenant_id}</dd><dt>允许访问</dt><dd>{tenant.modules.join('、') || '未授权模块'}</dd><dt>存储配额</dt><dd>{tenant.storage_limit_bytes ? `${tenant.storage_limit_bytes.toLocaleString()} B` : '不限额'}</dd><dt>已用空间</dt><dd>{tenant.used_bytes === null ? '暂不可用' : `${tenant.used_bytes.toLocaleString()} B`}</dd></dl><p className="detail-help">可在“租户与配额”中修改租户设置。</p></div></dialog>;
}
export default function BusinessTenants({ tenantID, moduleID, revision, onSelect }: { tenantID: string; moduleID: string; revision: number; onSelect: (id: string) => void }) {
  const selected = useBusinessTenant(tenantID, revision);
  const [query, setQuery] = useState(''); const [cursor, setCursor] = useState(''); const [retry, setRetry] = useState(0);
  const [data, setData] = useState<{ query: string; items: TenantData[]; next: string }>({ query: '', items: [], next: '' });
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [details, setDetails] = useState(false);
  const expire = useContext(SessionExpired); const sequence = useRef(0);
  useEffect(() => {
    const current = ++sequence.current; const controller = new AbortController(); setLoading(true); setError('');
    const timer = window.setTimeout(() => {
      void request<ManagementResponse<Page>>(adminPath('tenants', { q: query, limit: '20', cursor }), { signal: controller.signal }).then(result => {
        if (current !== sequence.current || controller.signal.aborted) return;
        setData(old => ({ query, items: cursor && old.query === query ? [...old.items, ...result.data.items.filter(t => !old.items.some(p => p.tenant_id === t.tenant_id))] : result.data.items, next: result.data.next_cursor ?? '' })); setLoading(false);
      }).catch((err: unknown) => { if (current !== sequence.current || controller.signal.aborted) return; if (err instanceof APIError && err.status === 401) expire(); setError(err instanceof Error ? err.message : '租户读取失败。'); setLoading(false); });
    }, query ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, cursor, retry, revision, expire]);
  const current = selected.response?.data;
  return <><BusinessTenantBar tenants={(data.query === query ? data.items : []).map(tenantView)} selectedTenant={current ? tenantView(current) : undefined} tenantID={tenantID} moduleID={moduleID} onSelect={onSelect} onDetails={() => setDetails(true)} remote={{ search: q => { setQuery(q); setCursor(''); }, more: data.query === query && !!data.next, load: () => setCursor(data.next), loading, error, retry: () => setRetry(n => n + 1) }}/>{details && current && <Detail tenant={current} onClose={() => setDetails(false)}/>}</>;
}
