import { toast } from './components/Toast';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import Icon from './Icon';
import type { IconName } from './Icon';
import Select from './components/Select';
import useDrawer from './components/useDrawer';
import './credentials-preview.css';

type Kind = 'admin' | 'tenant' | 'monitor';
type Tab = Kind | 'all' | 'active' | 'revoked';
type Credential = { id: string; name: string; kind: Kind; tenant?: string; created: number; expires: number; revoked?: number };
const day = 86400000;
const tenants = [
  { value: 'commerce-prod', label: '电商生产环境', modules: '配置中心' },
  { value: 'commerce-staging', label: '电商测试环境', modules: '配置中心' },
  { value: 'internal-tools', label: '内部工具', modules: '配置中心' },
];
const kinds: Record<Kind, { label: string; icon: IconName; description: string; permission: string }> = {
  admin: { label: '管理凭证', icon: 'shield', description: '登录控制台与管理集群', permission: '管理集群、节点、租户及凭证；可访问监控指标。不授予租户业务数据访问权限。' },
  tenant: { label: '租户凭证', icon: 'tenant', description: '通过 API 或 SDK 访问业务', permission: '仅访问所属租户已授权的业务模块，受租户模块权限与配额约束。' },
  monitor: { label: '监控凭证', icon: 'activity', description: '读取监控指标', permission: '访问 /metrics 监控指标；不能管理集群，也不能访问租户业务数据。' },
};
const tenantName = (id?: string) => tenants.find(t => t.value === id)?.label ?? id ?? '整个集群';
const date = (value: number) => value === 0 ? '永不过期' : new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '-');
function initialCredentials(now: number): Credential[] {
  return [
    { id: 'credential_86a1c0d85b20', name: '日常运维', kind: 'admin', created: now - 14 * day, expires: 0 },
    { id: 'credential_31e84ba7c902', name: '订单服务 · production', kind: 'tenant', tenant: 'commerce-prod', created: now - 8 * day, expires: now + 82 * day },
    { id: 'credential_7be0f2d103ac', name: 'Prometheus · 主监控', kind: 'monitor', created: now - 87 * day, expires: now + 3 * day },
    { id: 'credential_92fc7a3d0418', name: '订单服务 · staging', kind: 'tenant', tenant: 'commerce-staging', created: now - 5 * day, expires: now + 25 * day },
    { id: 'credential_a8e204bc136f', name: '内部自动化服务', kind: 'tenant', tenant: 'internal-tools', created: now - 21 * day, expires: now + 69 * day },
    { id: 'credential_53d8ab2e170c', name: 'Prometheus · 备用监控', kind: 'monitor', created: now - 3 * day, expires: now + 87 * day },
    { id: 'credential_f63d17529ab0', name: '发布联调', kind: 'tenant', tenant: 'commerce-staging', created: now - 32 * day, expires: now - 2 * day },
    { id: 'credential_10e47a92d5bc', name: '临时维护', kind: 'admin', created: now - 20 * day, expires: now + 10 * day, revoked: now - 4 * day },
  ];
}
function status(c: Credential, now: number) { return c.revoked ? 'revoked' : (c.expires !== 0 && c.expires <= now) ? 'expired' : 'active'; }
function soon(c: Credential, now: number) { return status(c, now) === 'active' && c.expires !== 0 && c.expires - now <= 7 * day; }
function Status({ credential, now }: { credential: Credential; now: number }) {
  const state = status(credential, now);
  return <span className={`status state-${state === 'active' ? 'healthy' : 'credential-inactive-status'}`}><i/>{state === 'active' ? '有效' : state === 'expired' ? '已过期' : '已撤销'}</span>;
}
function KindMark({ kind }: { kind: Kind }) { return <span className={`credential-mark kind-${kind}`}><Icon name={kinds[kind].icon} size={18}/></span>; }

function Modal({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!; const focused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    el.showModal(); document.body.style.overflow = 'hidden';
    return () => { el.close(); document.body.style.overflow = overflow; focused?.focus(); };
  }, []);
  return <dialog className="credential-modal" ref={ref} aria-labelledby="credential-modal-title" onCancel={e => { e.preventDefault(); onClose(); }}>
    <header><div><h2 id="credential-modal-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="关闭弹窗" onClick={onClose}><Icon name="close" size={18}/></button></header>{children}
  </dialog>;
}
function CredentialEditor({ initialKind, now, onCreated, onClose }: { initialKind: Kind; now: number; onCreated: (c: Credential) => void; onClose: () => void }) {
  const [kind, setKind] = useState(initialKind);
  const [name, setName] = useState('');
  const [tenant, setTenant] = useState(tenants[0].value);
  const [duration, setDuration] = useState('90');
  const [created, setCreated] = useState<Credential | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault(); if (!name.trim()) return;
    const c: Credential = { id: `credential_${(globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`).replaceAll('-', '').slice(0, 12)}`, name: name.trim(), kind, tenant: kind === 'tenant' ? tenant : undefined, created: now, expires: duration==='0'?0:now + Number(duration) * day };
    onCreated(c); setCreated(c);
  }
  const token = created ? `preview_not_valid_${created.id}` : '';
  return <Modal title={created ? '凭证已创建' : '创建凭证'} subtitle={created ? 'Token 仅在创建后显示，请妥善保存。' : '选择用途，并设置名称和有效期。'} onClose={onClose}>
    {created ? <><div className="credential-modal-body"><div className="credential-created"><Icon name="check" size={20}/><div><strong>{created.name}</strong><span>{kinds[created.kind].label} · {created.expires===0?'永不过期':`到期于 ${date(created.expires)}`}</span></div></div><label className="credential-field-label" htmlFor="preview-credential-token">Token</label><textarea id="preview-credential-token" className="credential-token" readOnly value={token} spellCheck={false}/><p className="credential-help">当前为本地预览，此占位 Token 不能用于访问集群。</p>{copyError && <p role="alert" className="credential-error">{copyError}</p>}</div><footer><button className="outline-button" onClick={() => { if (!navigator.clipboard?.writeText) { setCopyError('当前浏览器不支持直接复制，请选中上方 Token 手动复制。'); return; } void navigator.clipboard.writeText(token).then(() => { setCopied(true); setCopyError(''); }).catch(() => setCopyError('请选中上方 Token 手动复制。')); }}><Icon name={copied ? 'check' : 'copy'} size={15}/>{copied ? '已复制' : '复制 Token'}</button><button className="tenant-primary-button" onClick={onClose}>完成</button></footer></> : <form onSubmit={submit}>
      <div className="credential-modal-body"><fieldset className="credential-kind-options"><legend>凭证类型</legend>{(Object.keys(kinds) as Kind[]).map(k => <label key={k} className={kind === k ? 'selected' : ''}><input type="radio" name="credential-kind" checked={kind === k} onChange={() => setKind(k)}/><Icon name={kinds[k].icon} size={19}/><span>{kinds[k].label}</span></label>)}</fieldset>
        <label className="credential-field-label" htmlFor="credential-name">凭证名称</label><input id="credential-name" autoFocus required maxLength={80} placeholder="例如：订单服务 · production" value={name} onChange={e => setName(e.target.value)}/><p className="credential-help">用于识别使用方，便于后续维护和撤销。</p>
        {kind === 'tenant' && <div className="credential-form-select"><span className="credential-field-label">所属租户</span><Select label="所属租户" value={tenant} onChange={setTenant} options={tenants}/></div>}
        <div className="credential-form-select"><span className="credential-field-label">有效期</span><Select label="凭证有效期" value={duration} onChange={setDuration} options={[{ value: '7', label: '7 天' }, { value: '30', label: '30 天' }, { value: '90', label: '90 天' }, { value: '180', label: '180 天' }, { value: '365', label: '365 天' }, {value:'0',label:'永不过期'}]}/><p className="credential-help">预计到期：{date(duration==='0'?0:now + Number(duration) * day)}</p></div>
        <div className="credential-permission-note"><Icon name="shield" size={18}/><div><strong>访问范围</strong><p>{kinds[kind].permission}</p>{kind === 'tenant' && <span className="credential-module-tag">{tenants.find(t => t.value === tenant)?.modules}</span>}</div></div>
      </div><footer><button type="button" className="outline-button" onClick={onClose}>取消</button><button className="tenant-primary-button" type="submit" disabled={!name.trim()}>创建凭证</button></footer>
    </form>}
  </Modal>;
}
function CredentialDetails({ credential: c, now, onClose, onRevoke, onDelete }: { credential: Credential; now: number; onClose: () => void; onRevoke: () => void; onDelete: () => void }) {
  const { dialog, closing, requestClose, onAnimationEnd } = useDrawer(onClose);
  return <dialog ref={dialog} className={`inspect-drawer credential-drawer${closing ? ' is-closing' : ''}`} aria-labelledby="credential-detail-title" onAnimationEnd={onAnimationEnd} onCancel={e => { e.preventDefault(); requestClose(); }} onClick={e => { if (e.target === e.currentTarget && e.clientX < e.currentTarget.getBoundingClientRect().left) requestClose(); }}>
    <header className="drawer-header"><div><div className="eyebrow">凭证详情</div><h2 id="credential-detail-title">{c.name}</h2><p>{kinds[c.kind].description}</p></div><button className="icon-button" autoFocus aria-label="关闭凭证详情" onClick={requestClose}><Icon name="close"/></button></header>
    <div className="drawer-body"><div className="credential-detail-banner"><KindMark kind={c.kind}/><div><strong>{kinds[c.kind].label}</strong><span>{c.kind === 'tenant' ? tenantName(c.tenant) : '集群级访问'}</span></div><Status credential={c} now={now}/></div>
      <h3>基本信息</h3><dl className="detail-fields"><dt>凭证名称</dt><dd>{c.name}</dd><dt>凭证标识</dt><dd><code>{c.id}</code></dd><dt>签发时间</dt><dd>{date(c.created)}</dd><dt>到期时间</dt><dd>{date(c.expires)}{soon(c, now) && <span className="credential-expiry-note">7 天内到期</span>}</dd>{c.revoked && <><dt>撤销时间</dt><dd>{date(c.revoked)}</dd></>}</dl>
      <section className="credential-detail-section"><h3>访问权限</h3><div className="credential-permission-note"><Icon name={kinds[c.kind].icon} size={19}/><div><strong>{c.kind === 'tenant' ? tenantName(c.tenant) : c.kind === 'admin' ? '集群管理与监控' : '监控指标'}</strong><p>{kinds[c.kind].permission}</p>{c.kind === 'tenant' && <span className="credential-module-tag">配置中心</span>}</div></div></section>
      <section className="credential-detail-section"><h3>Token</h3><div className="credential-hidden-token"><Icon name="key" size={17}/><span>•••• •••• •••• ••••</span></div><p className="credential-help">Token 只在创建时显示。无法重新查看，需要时请创建新的凭证。</p></section>
      {c.kind === 'admin' && <p className="credential-help">撤销管理凭证后，由它建立的登录会话也将失效。</p>}
    </div><footer className="credential-drawer-footer"><button className="outline-button" onClick={requestClose}>关闭</button>{status(c, now) !== 'revoked' && <button className="credential-danger-outline" onClick={onRevoke}>撤销凭证</button>}{status(c,now)==='revoked'&&<button className="credential-danger-outline" onClick={onDelete}>删除凭证</button>}</footer>
  </dialog>;
}

export default function CredentialsPreview() {
  const [now] = useState(Date.now);
  const [credentials, setCredentials] = useState(() => initialCredentials(now));
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState(''); const [tenant, setTenant] = useState('');
  const [limit, setLimit] = useState('20'); const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null); const [creating, setCreating] = useState(false); const [revoking, setRevoking] = useState<Credential | null>(null);
  const [deleting,setDeleting]=useState<Credential|null>(null);
  const setNotice = toast.success;
  const active = credentials.filter(c => status(c, now) === 'active').length;
  const expiring = credentials.filter(c => soon(c, now)).length;
  const filtered = credentials.filter(c => (tab === 'all' || (tab==='active'||tab==='revoked'?status(c,now)===tab:c.kind === tab)) && (!tenant || c.tenant === tenant) && (!filter || (filter === 'expiring' ? soon(c, now) : status(c, now) === filter)) && `${c.name} ${c.id} ${c.tenant ?? ''} ${c.tenant ? tenantName(c.tenant) : ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  filtered.sort((a,b)=>({active:0,expired:1,revoked:2}[status(a,now)]-{active:0,expired:1,revoked:2}[status(b,now)] || b.created-a.created || a.id.localeCompare(b.id)));
  const visible = filtered.slice(page * Number(limit), (page + 1) * Number(limit));
  const detail = credentials.find(c => c.id === selected);
  function reset() { if(tab==='active'||tab==='revoked')setTab('all');setQuery(''); setFilter(''); setTenant(''); setPage(0); }
  function chooseTab(value: Tab) { setTab(value); setFilter(''); setTenant(''); setPage(0); }
  function requestDelete(c:Credential){setSelected(null);setDeleting(c)}
  function requestRevoke(c: Credential) { setSelected(null); setRevoking(c); }
  return <div className="credentials-page">
    <div className="credential-summary">{[
      { label: '有效凭证', value: active, hint: '可用于已授权的访问范围', icon: 'key' as const, action: () => { reset(); setTab('active'); } },
      { label: '7 天内到期', value: expiring, hint: '及时创建新凭证并更新使用方', icon: 'clock' as const, action: () => { reset(); setTab('all'); setFilter('expiring'); } },
      { label: '已失效凭证', value: credentials.length - active, hint: '包含已过期和已撤销的凭证', icon: 'shield' as const },
    ].map(item => <section key={item.label}><div><span>{item.label}</span>{item.action ? <button className="credential-stat-value" onClick={item.action} aria-label={`筛选${item.label}`}>{item.value}<Icon name="arrow" size={14}/></button> : <strong className="credential-stat-value">{item.value}</strong>}<small>{item.hint}</small></div><span className="credential-stat-icon"><Icon name={item.icon} size={22}/></span></section>)}</div>

    <section className="panel"><div className="panel-heading"><h2>凭证列表 <span>{credentials.length}</span></h2><button className="tenant-primary-button" onClick={() => setCreating(true)}><Icon name="plus" size={15}/>创建凭证</button></div>
      <div className="credential-tabs" aria-label="凭证类型筛选">{(['all', 'admin', 'tenant', 'monitor', 'active', 'revoked'] as const).map(kind => <button key={kind} aria-pressed={tab === kind} className={tab === kind ? 'active' : ''} onClick={() => chooseTab(kind)}>{kind === 'all' ? '全部凭证' : kind==='active'?'有效':kind==='revoked'?'已撤销':kinds[kind].label}<span>{kind === 'all' ? credentials.length : credentials.filter(c => kind==='active'||kind==='revoked'?status(c,now)===kind:c.kind === kind).length}</span></button>)}</div>
      <div className="list-toolbar"><label className="search-field"><Icon name="search" size={17}/><input aria-label="搜索凭证" placeholder="搜索名称、凭证标识或租户…" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }}/>{query && <button aria-label="清空凭证搜索" onClick={() => { setQuery(''); setPage(0); }}><Icon name="close" size={14}/></button>}</label><Select label="筛选凭证状态" value={tab==='active'||tab==='revoked'?tab:filter} onChange={value => { if(tab==='active'||tab==='revoked')setTab('all');setFilter(value); setPage(0); }} options={[{ value: '', label: '全部状态' }, { value: 'active', label: '有效' }, { value: 'expiring', label: '7 天内到期' }, { value: 'expired', label: '已过期' }, { value: 'revoked', label: '已撤销' }]}/>{tab === 'tenant' && <Select label="筛选所属租户" value={tenant} onChange={value => { setTenant(value); setPage(0); }} options={[{ value: '', label: '全部租户' }, ...tenants]}/>}{(query || filter || tenant) && <button className="text-button" onClick={reset}>清除筛选</button>}<span className="credential-list-note"><Icon name="shield" size={14}/>列表不展示 Token</span></div>
      <div className="table-scroll"><table className="dense-table credential-table"><thead><tr><th>凭证 / 标识</th><th>类型</th><th>访问范围</th><th>签发时间</th><th>到期时间</th><th>状态</th><th>操作</th></tr></thead><tbody>{visible.map(c => <tr key={c.id} className={status(c, now) !== 'active' ? 'credential-inactive' : ''}><td><div className="credential-identity"><KindMark kind={c.kind}/><div><button className="resource-link" onClick={() => setSelected(c.id)}>{c.name}</button><code className="cell-secondary">{c.id}</code></div></div></td><td><span className={`credential-type type-${c.kind}`}>{kinds[c.kind].label}</span></td><td><span className="credential-scope">{c.kind === 'tenant' ? tenantName(c.tenant) : c.kind === 'admin' ? '集群管理与监控' : '监控指标'}</span><small className="cell-secondary">{c.kind === 'tenant' ? c.tenant : c.kind === 'admin' ? '管理 API / Web UI' : '/metrics'}</small></td><td className="credential-date">{date(c.created)}</td><td className="credential-date">{date(c.expires)}{soon(c, now) && <small className="credential-expiry-note">{Math.ceil((c.expires - now) / day)} 天后到期</small>}</td><td><Status credential={c} now={now}/></td><td><div className="credential-row-actions">{status(c, now) !== 'revoked' && <button className="text-button credential-revoke" aria-label={`撤销凭证 ${c.name}`} onClick={() => requestRevoke(c)}>撤销</button>}<>{status(c,now)==='revoked'&&<button className="text-button credential-revoke" aria-label={`删除凭证 ${c.name}`} onClick={()=>requestDelete(c)}>删除</button>}</><button className="text-button" aria-label={`查看凭证 ${c.name}`} onClick={() => setSelected(c.id)}>详情<Icon name="arrow" size={12}/></button></div></td></tr>)}</tbody></table></div>
      {!visible.length && <div className="list-empty"><Icon name="search" size={25}/><h3>未找到匹配的凭证</h3><p>请调整名称、类型或状态筛选。</p><button className="outline-button" onClick={() => { reset(); setTab('all'); }}>清除筛选</button></div>}
      <div className="pagination"><span>共 {filtered.length} 个凭证 · 第 {page + 1} 页</span><Select label="凭证每页条数" value={limit} onChange={value => { setLimit(value); setPage(0); }} options={['5', '20', '50'].map(value => ({ value, label: `每页 ${value} 条` }))}/><button className="outline-button" disabled={page === 0} onClick={() => setPage(p => p - 1)}>上一页</button><button className="outline-button" disabled={(page + 1) * Number(limit) >= filtered.length} onClick={() => setPage(p => p + 1)}>下一页</button></div>
    </section>
    <div className="credential-boundaries"><Icon name="shield" size={16}/><p>管理权限与业务访问独立。租户凭证仅能访问所属租户，监控凭证仅能读取指标。</p></div>
    {detail && <CredentialDetails credential={detail} now={now} onClose={() => setSelected(null)} onRevoke={() => requestRevoke(detail)} onDelete={()=>requestDelete(detail)}/>}
    {creating && <CredentialEditor now={now} initialKind={tab==='admin'||tab==='tenant'||tab==='monitor'?tab:'tenant'} onClose={() => setCreating(false)} onCreated={c => { setCredentials(items => [c, ...items]); reset(); setTab('all'); }}/>}
    {deleting&&<Modal title="删除凭证" subtitle="仅删除已撤销的凭证记录，Token 不会恢复有效。" onClose={()=>setDeleting(null)}><div className="credential-modal-body"><div className="credential-revoke-target"><KindMark kind={deleting.kind}/><div><strong>{deleting.name}</strong><code>{deleting.id}</code></div></div><p className="credential-revoke-description">删除后，该凭证将从列表中移除，此操作不可撤回。</p></div><footer><button className="outline-button" onClick={()=>setDeleting(null)}>取消</button><button className="credential-danger-button" onClick={()=>{setCredentials(items=>items.filter(c=>c.id!==deleting.id));setNotice(`已删除「${deleting.name}」。`);setPage(0);setDeleting(null)}}>确认删除</button></footer></Modal>}
    {revoking && <Modal title="撤销凭证" subtitle="撤销后无法恢复，请确认使用方已切换凭证。" onClose={() => setRevoking(null)}><div className="credential-modal-body"><div className="credential-revoke-target"><KindMark kind={revoking.kind}/><div><strong>{revoking.name}</strong><code>{revoking.id}</code></div></div><p className="credential-revoke-description">{revoking.kind === 'admin' ? '使用此凭证的管理请求及由它建立的登录会话将失效。' : revoking.kind === 'tenant' ? '使用此凭证的应用将无法继续访问租户，已有数据不受影响。' : '使用此凭证的监控程序将无法继续采集指标。'}</p></div><footer><button className="outline-button" onClick={() => setRevoking(null)}>取消</button><button className="credential-danger-button" onClick={() => { setCredentials(items => items.map(c => c.id === revoking.id ? { ...c, revoked: now } : c)); setNotice(`已在预览中撤销「${revoking.name}」。`); setPage(0); setRevoking(null); }}>确认撤销</button></footer></Modal>}
  </div>;
}
