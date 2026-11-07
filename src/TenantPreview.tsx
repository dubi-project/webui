import { toast } from './components/Toast';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Icon from './Icon';
import Select from './components/Select';
import useDrawer from './components/useDrawer';
import './tenant-preview.css';

type Credential = { id: string; created: string; expires: string | null; status: 'active' | 'expired' | 'revoked' };
type Tenant = { id: string; name: string; modules: string[]; quotaGiB: number | null; usedGiB: number; credentials: Credential[] };
const moduleOptions = [{ id: 'config', name: '配置中心' }, { id: 'cache', name: '分布式缓存' }];
function Modules({ modules }: { modules: string[] }) { return <div className="tenant-module-tags">{modules.length ? modules.map(id => <span key={id}>{moduleOptions.find(item => item.id === id)?.name ?? id}</span>) : <span>未授权模块</span>}</div>; }
function Quota({ tenant }: { tenant: Tenant }) { return <div className="tenant-quota"><strong>{tenant.usedGiB.toLocaleString()} GiB</strong><span> / {tenant.quotaGiB === null ? '不限额' : `${tenant.quotaGiB} GiB`}</span>{tenant.quotaGiB !== null && <div className="meter"><span style={{ width: `${Math.min(100, tenant.usedGiB / tenant.quotaGiB * 100)}%` }}/></div>}</div>; }
const initialTenants: Tenant[] = [
  { id: 'commerce-prod', name: '电商生产环境', modules: ['config', 'cache'], quotaGiB: 100, usedGiB: 36.4, credentials: [
    { id: 'cred_c31e8a', created: '2026-11-02 09:30', expires: '2027-02-02 09:30', status: 'active' },
    { id: 'cred_a820df', created: '2026-10-18 14:20', expires: '2027-01-18 14:20', status: 'active' },
    { id: 'cred_f63d17', created: '2026-09-01 10:00', expires: '2026-10-01 10:00', status: 'expired' },
  ] },
  { id: 'commerce-staging', name: '电商测试环境', modules: ['config', 'cache'], quotaGiB: 20, usedGiB: 4.2, credentials: [{ id: 'cred_9fe2ab', created: '2026-11-04 16:00', expires: '2026-12-04 16:00', status: 'active' }] },
  { id: 'website', name: '官方网站', modules: ['config'], quotaGiB: 10, usedGiB: 0.6, credentials: [{ id: 'cred_b917a0', created: '2026-11-01 08:15', expires: null, status: 'active' }] },
  { id: 'internal-tools', name: '内部工具', modules: ['config', 'cache'], quotaGiB: null, usedGiB: 8.1, credentials: [
    { id: 'cred_d34e10', created: '2026-10-28 11:40', expires: '2027-01-28 11:40', status: 'active' },
    { id: 'cred_83ba09', created: '2026-10-07 09:00', expires: '2027-01-07 09:00', status: 'revoked' },
  ] },
  { id: 'sandbox', name: '开发沙箱', modules: ['config', 'cache'], quotaGiB: 5, usedGiB: 0, credentials: [] },
  { id: 'legacy-service', name: '旧版业务', modules: ['config'], quotaGiB: 10, usedGiB: 2.3, credentials: [{ id: 'cred_70ca42', created: '2026-08-01 15:00', expires: '2026-11-01 15:00', status: 'expired' }] },
];
const activeCount = (tenant: Tenant) => tenant.credentials.filter(item => item.status === 'active').length;
const credentialLabels = { active: '有效', expired: '已过期', revoked: '已撤销' };
function AccessStatus({ tenant }: { tenant: Tenant }) {
  const active = activeCount(tenant) > 0 && tenant.modules.length > 0;
  return <span className={`status state-${active ? 'healthy' : 'warning'}`} title="根据允许访问的模块和有效凭证统计"><i/>{!tenant.modules.length ? '未授权模块' : active ? '可访问' : '无有效凭证'}</span>;
}

function TenantDetails({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const { dialog, closing, requestClose, onAnimationEnd } = useDrawer(onClose);
  const active = activeCount(tenant);
  return <dialog ref={dialog} className={`inspect-drawer tenant-drawer${closing ? ' is-closing' : ''}`} aria-labelledby="tenant-detail-title" onAnimationEnd={onAnimationEnd} onCancel={event => { event.preventDefault(); requestClose(); }} onClick={event => { if (event.target === event.currentTarget && event.clientX < event.currentTarget.getBoundingClientRect().left) requestClose(); }}>
    <header className="drawer-header"><div><div className="eyebrow">租户详情</div><h2 id="tenant-detail-title">{tenant.name}</h2><p><code>{tenant.id}</code></p></div><button className="icon-button" aria-label="关闭租户详情" onClick={requestClose} autoFocus><Icon name="close"/></button></header>
    <div className="drawer-body">
      <div className="tenant-detail-banner"><span className="tenant-mark"><Icon name="tenant" size={23}/></span><div><span>访问状态</span><AccessStatus tenant={tenant}/></div></div>
      <h3>基本信息</h3><dl className="detail-fields"><dt>租户名称</dt><dd>{tenant.name}</dd><dt>租户标识</dt><dd><code>{tenant.id}</code></dd><dt>有效凭证</dt><dd>{active} 个</dd><dt>全部凭证</dt><dd>{tenant.credentials.length} 个</dd></dl>
      <section className="tenant-policy-section"><h3>允许访问的模块</h3><Modules modules={tenant.modules}/><p className="detail-help">凭证权限受租户的模块范围限制。</p></section>
      <section className="tenant-policy-section"><h3>整体存储配额</h3><Quota tenant={tenant}/><p className="detail-help">所有模块共享，按逻辑数据总量统计，不含集群冗余存储。</p></section>
      <div className="tenant-section-heading"><h3>访问凭证</h3><span>{tenant.credentials.length}</span></div>
      {tenant.credentials.length ? <div className="table-scroll tenant-credential-list"><table className="dense-table"><thead><tr><th>凭证 / 签发时间</th><th>到期时间</th><th>状态</th></tr></thead><tbody>{tenant.credentials.map(item => <tr key={item.id}><td><code>{item.id}</code><small className="cell-secondary">{item.created}</small></td><td>{item.expires || '长期有效'}</td><td><span className={`status state-${item.status === 'active' ? 'healthy' : item.status === 'expired' ? 'warning' : 'unknown'}`}><i/>{credentialLabels[item.status]}</span></td></tr>)}</tbody></table></div> : <div className="tenant-no-credentials"><Icon name="key" size={25}/><h3>尚无访问凭证</h3><p>应用连接此租户前，需要创建租户访问凭证。</p></div>}
      <p className="detail-help">此处仅展示凭证标识，不展示 Token 内容。</p>
    </div>
  </dialog>;
}

function TenantEditor({ existing, initial, onCancel, onSave }: { existing: Tenant[]; initial?: Tenant; onCancel: () => void; onSave: (tenant: Tenant) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [id, setId] = useState(initial?.id ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [modules, setModules] = useState(initial?.modules ?? ['config']);
  const [unlimited, setUnlimited] = useState(initial?.quotaGiB == null);
  const [quota, setQuota] = useState(String(initial?.quotaGiB ?? 10));
  const [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  function submit(event: FormEvent) {
    event.preventDefault();
    const value = id.trim();
    if (!value) { setError('请输入租户标识。'); return; }
    if (existing.some(tenant => tenant.id === value && tenant.id !== initial?.id)) { setError('该租户标识已存在。'); return; }
    if (!name.trim()) { setError('请输入租户名称。'); return; }
    const quotaGiB = unlimited ? null : Number(quota);
    if (quotaGiB !== null && (!quota.trim() || !Number.isFinite(quotaGiB) || quotaGiB <= 0)) { setError('请输入大于 0 的存储配额。'); return; }
    onSave({ id: value, name: name.trim(), modules, quotaGiB, usedGiB: initial?.usedGiB ?? 0, credentials: initial?.credentials ?? [] });
  }
  return <dialog ref={dialog} className="tenant-create-dialog" aria-labelledby="tenant-create-title" onCancel={event => { event.preventDefault(); onCancel(); }}>
    <form onSubmit={submit}><header><div><h2 id="tenant-create-title">{initial ? '租户设置' : '创建租户'}</h2><p>设置显示名称、模块范围和整体配额。</p></div><button type="button" className="icon-button" aria-label="关闭租户表单" onClick={onCancel}><Icon name="close" size={18}/></button></header>
      <label htmlFor="tenant-name">租户名称</label><input id="tenant-name" autoFocus autoComplete="off" maxLength={80} placeholder="例如 电商生产环境" value={name} onChange={event => { setName(event.target.value); setError(''); }}/>
      <label className="tenant-field-label" htmlFor="tenant-id">租户标识</label><input id="tenant-id" readOnly={!!initial} autoComplete="off" maxLength={128} placeholder="例如 commerce-prod" value={id} onChange={event => { setId(event.target.value); setError(''); }} aria-invalid={!!error} aria-describedby="tenant-id-help"/>
      <p id="tenant-id-help" className="detail-help">用于 API 和 SDK 访问，集群内唯一，创建后保持不变。</p>
      <fieldset className="tenant-module-choices"><legend>允许访问的模块</legend>{moduleOptions.map(item => <label key={item.id}><input type="checkbox" checked={modules.includes(item.id)} onChange={event => setModules(values => event.target.checked ? [...values, item.id] : values.filter(value => value !== item.id))}/><span>{item.name}</span></label>)}</fieldset>
      <p className="detail-help">仅允许访问所选模块。新增模块需另行授权。</p>
      <fieldset className="tenant-quota-fields"><legend>整体存储配额</legend><label className="tenant-check"><input type="checkbox" checked={unlimited} onChange={event => setUnlimited(event.target.checked)}/>不限额</label>{!unlimited && <div className="tenant-quota-input"><input type="number" aria-label="存储配额 GiB" min="0.01" step="any" value={quota} onChange={event => { setQuota(event.target.value); setError(''); }}/><span>GiB</span></div>}</fieldset>
      <p className="detail-help">所有模块共用此额度，按逻辑数据总量统计。</p>
      {initial && !unlimited && Number(quota) < initial.usedGiB && <p className="tenant-form-error">低于当前用量，保存后将限制新增数据；已有数据保留。（规则预览）</p>}
      {error && <p className="tenant-form-error" role="alert">{error}</p>}
      <div className="tenant-create-note"><Icon name="key" size={16}/><span>创建后可为应用配置访问凭证。</span></div>
      <footer><span>仅预览，数据不保存到集群</span><button type="button" className="outline-button" onClick={onCancel}>取消</button><button type="submit" className="tenant-primary-button">{initial ? '保存设置' : '创建租户'}</button></footer>
    </form>
  </dialog>;
}

export default function TenantPreview() {
  const [tenants, setTenants] = useState(initialTenants);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [limit, setLimit] = useState('20');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Tenant | 'new' | null>(null);
  const setNotice = toast.success;
  const filtered = tenants.filter(tenant => `${tenant.name} ${tenant.id}`.toLowerCase().includes(query.trim().toLowerCase()) && (!status || (!tenant.modules.length ? 'unauthorized' : activeCount(tenant) > 0 ? 'active' : 'inactive') === status));
  const visible = filtered.slice(page * Number(limit), (page + 1) * Number(limit));
  const selectedTenant = tenants.find(tenant => tenant.id === selected);
  const activeTenants = tenants.filter(tenant => activeCount(tenant) > 0).length;
  function reset() { setQuery(''); setStatus(''); setPage(0); }
  return <>
    <div className="tenant-summary">{[
      { label: '租户总数', value: tenants.length, icon: 'tenant' as const },
      { label: '有效访问凭证', value: tenants.reduce((sum, tenant) => sum + activeCount(tenant), 0), icon: 'key' as const },
      { label: '无有效凭证的租户', value: tenants.length - activeTenants, icon: 'alert' as const },
    ].map(item => <section key={item.label}><div><span>{item.label}</span><strong>{item.value}</strong></div><span className="tenant-summary-icon"><Icon name={item.icon} size={22}/></span></section>)}</div>

    <section className="panel"><div className="panel-heading"><h2>租户列表 <span>{tenants.length}</span></h2><button className="tenant-primary-button" onClick={() => setEditing('new')}><span aria-hidden="true">＋</span>创建租户</button></div>
      <div className="list-toolbar"><label className="search-field"><Icon name="search" size={17}/><input aria-label="搜索租户" placeholder="搜索租户名称或标识…" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }}/>{query && <button aria-label="清空租户搜索" onClick={() => { setQuery(''); setPage(0); }}><Icon name="close" size={14}/></button>}</label><Select label="筛选租户访问状态" value={status} onChange={value => { setStatus(value); setPage(0); }} options={[{ value: '', label: '全部状态' }, { value: 'active', label: '可访问' }, { value: 'inactive', label: '无有效凭证' }, { value: 'unauthorized', label: '未授权模块' }]}/>{(query || status) && <button className="text-button" onClick={reset}>清除筛选</button>}</div>
      <div className="table-scroll"><table className="dense-table tenant-table"><thead><tr><th>租户 / 标识</th><th>允许访问的模块</th><th>用量 / 存储配额</th><th>访问凭证</th><th>状态</th><th>操作</th></tr></thead><tbody>{visible.map(tenant => <tr key={tenant.id}><td><button className="resource-link" onClick={() => setSelected(tenant.id)}><span className="tenant-row-icon"><Icon name="tenant" size={17}/></span>{tenant.name}</button><code className="cell-secondary tenant-id-secondary">{tenant.id}</code></td><td><Modules modules={tenant.modules}/></td><td><Quota tenant={tenant}/></td><td><strong>{activeCount(tenant)}</strong> 个有效<small className="cell-secondary">共 {tenant.credentials.length} 个凭证</small></td><td><AccessStatus tenant={tenant}/></td><td><div className="tenant-row-actions"><button className="text-button" onClick={() => setEditing(tenant)} aria-label={`设置租户 ${tenant.name}`}>设置</button><button className="text-button" onClick={() => setSelected(tenant.id)} aria-label={`查看租户 ${tenant.name}`}>详情<Icon name="arrow" size={13}/></button></div></td></tr>)}</tbody></table></div>
      {!visible.length && <div className="list-empty"><Icon name="search" size={25}/><h3>未找到匹配的租户</h3><p>请尝试其他租户标识或调整状态筛选。</p><button className="outline-button" onClick={reset}>清除筛选</button></div>}
      <div className="pagination"><span>共 {filtered.length} 个租户 · 第 {page + 1} 页</span><Select label="每页条数" value={limit} onChange={value => { setLimit(value); setPage(0); }} options={['20', '50', '100'].map(value => ({ value, label: `每页 ${value} 条` }))}/><button className="outline-button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>上一页</button><button className="outline-button" disabled={(page + 1) * Number(limit) >= filtered.length} onClick={() => setPage(value => value + 1)}>下一页</button></div>
    </section>
    {selectedTenant && <TenantDetails tenant={selectedTenant} onClose={() => setSelected(null)}/>}
    {editing && <TenantEditor existing={tenants} initial={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onSave={tenant => { setTenants(items => editing === 'new' ? [tenant, ...items] : items.map(item => item.id === tenant.id ? tenant : item)); setEditing(null); reset(); setNotice(`已保存预览租户 ${tenant.name}，仅在当前页面保留。`); }}/>}
  </>;
}
