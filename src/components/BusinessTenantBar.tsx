import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon';
import './business-tenant.css';

export interface BusinessTenant { id: string; name: string; modules: string[] }
/** Shared tenant context for business-data pages; contains no authorization logic. */
export default function BusinessTenantBar({ tenants, tenantID, moduleID, onSelect, onDetails, selectedTenant, remote }: { tenants: BusinessTenant[]; tenantID: string; moduleID: string; onSelect: (id: string) => void; onDetails: (tenant: BusinessTenant) => void; selectedTenant?: BusinessTenant; remote?: { search: (query: string) => void; more: boolean; load: () => void; loading: boolean; error?: string; retry: () => void } }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(4);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const selected = selectedTenant ?? tenants.find(tenant => tenant.id === tenantID);
  const matching = remote ? tenants : tenants.filter(tenant => `${tenant.name} ${tenant.id}`.toLowerCase().includes(query.trim().toLowerCase()));
  const visible = remote ? matching : matching.slice(0, limit);
  const moduleName = moduleID === 'config' ? '配置中心' : '分布式缓存';
  useEffect(() => { setOpen(false); setQuery(''); }, [tenantID, moduleID]);
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    function close(event: PointerEvent) { if (!box.current?.contains(event.target as Node)) setOpen(false); }
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  function choose(id: string) { onSelect(id); setOpen(false); trigger.current?.focus(); }
  return <div className="business-tenant-bar">
    <div className="business-tenant-label"><Icon name="tenant" size={17}/><span>当前租户</span></div>
    <div className="business-tenant-picker" ref={box} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); } }}>
      <button ref={trigger} className="business-tenant-trigger" aria-label={`切换租户，当前${selected?.name ?? (tenantID ? '租户不可用' : '未选择')}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => { setOpen(!open); setQuery(''); setLimit(4); remote?.search(''); }}>
        <span><strong>{selected?.name ?? (tenantID ? '租户不可用' : '选择租户')}</strong><code>{selected?.id ?? (tenantID || '按租户查看业务数据')}</code></span><Icon name="chevron" size={15}/>
      </button>
      {open && <div className="business-tenant-popover" role="dialog" aria-label="选择业务租户">
        <div className="business-tenant-search"><Icon name="search" size={16}/><input ref={search} aria-label="搜索租户名称或标识" placeholder="搜索名称或标识…" value={query} onChange={event => { setQuery(event.target.value); setLimit(4); remote?.search(event.target.value); }} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); box.current?.querySelector<HTMLButtonElement>('.business-tenant-option')?.focus(); } }}/></div>
        <div className="business-tenant-options">{visible.map((tenant, index) => <button key={tenant.id} className="business-tenant-option" aria-label={`选择租户 ${tenant.name} ${tenant.id}`} aria-pressed={tenant.id === tenantID} onClick={() => choose(tenant.id)} onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const options = box.current?.querySelectorAll<HTMLButtonElement>('.business-tenant-option'); options?.[Math.max(0, Math.min(visible.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus(); }
        }}><span className="business-tenant-avatar">{tenant.name.slice(0, 1)}</span><span className="business-tenant-option-copy"><strong>{tenant.name}</strong><code>{tenant.id}</code></span>{!tenant.modules.includes(moduleID) && <small>未开通</small>}{tenant.id === tenantID && <Icon name="check" size={15}/>}</button>)}{!matching.length && !remote?.loading && !remote?.error && <p className="business-tenant-no-results">未找到匹配租户</p>}</div>
        {remote?.loading && <p className="business-tenant-no-results">正在加载租户…</p>}{remote?.error && <p className="business-tenant-no-results" role="alert">{remote.error}<button className="text-button" onClick={remote.retry}>重试</button></p>}{remote?.more && <button className="business-tenant-more" disabled={remote.loading} onClick={remote.load}>加载更多租户</button>}{!remote && matching.length > limit && <button className="business-tenant-more" onClick={() => setLimit(value => value + 4)}>加载更多租户 <span>已显示 {visible.length} / {matching.length}</span></button>}
        <footer>切换后查看所选租户的{moduleName}数据</footer>
      </div>}
    </div>
    <span className="business-tenant-context">业务模块之间沿用当前租户</span>
    {selected && <button className="text-button business-tenant-detail" onClick={() => onDetails(selected)}>租户详情<Icon name="arrow" size={13}/></button>}
  </div>;
}
