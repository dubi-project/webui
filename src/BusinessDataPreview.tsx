import { toast } from './components/Toast';
import { useState } from 'react';
import Icon from './Icon';
import BusinessTenantBar from './components/BusinessTenantBar';
import type { BusinessTenant } from './components/BusinessTenantBar';
import PreviewDialog from './components/PreviewDialog';
import Select from './components/Select';
import useDrawer from './components/useDrawer';
import './business-data-preview.css';

const tenants: BusinessTenant[] = [
  { id: 'commerce-prod', name: '电商生产环境', modules: ['config', 'cache'] },
  { id: 'commerce-staging', name: '电商测试环境', modules: ['config', 'cache'] },
  { id: 'website', name: '官方网站', modules: ['config'] },
  { id: 'internal-tools', name: '内部工具', modules: ['config', 'cache'] },
  { id: 'sandbox', name: '开发沙箱', modules: ['config', 'cache'] },
  { id: 'cache-only', name: '缓存专用', modules: ['cache'] },
];
type ConfigEntry = { key: string; value: string; version: number; created: number };
const initial: Record<string, ConfigEntry[]> = {
  'commerce-prod': [
    { key: 'checkout.payment', value: '{\n  "provider": "stripe",\n  "currency": "CNY",\n  "timeout_ms": 5000,\n  "retry_count": 3\n}', version: 7, created: 8 },
    { key: 'feature.new_checkout', value: '{\n  "enabled": true,\n  "rollout_percent": 20\n}', version: 3, created: 7 },
    { key: 'shipping.free_threshold', value: '199', version: 2, created: 6 },
    { key: 'app.display_name', value: 'DUBI Store', version: 1, created: 5 },
    { key: 'notification.channels', value: '{\n  "order_created": ["email", "push"],\n  "order_shipped": ["push"]\n}', version: 4, created: 4 },
    { key: 'inventory.low_stock', value: '10', version: 1, created: 3 },
    { key: 'homepage.announcement', value: '秋季新品已上线，欢迎选购。', version: 5, created: 2 },
    { key: 'service.order_timeout', value: '1800', version: 2, created: 1 },
  ],
  'commerce-staging': [{ key: 'checkout.payment', value: '{\n  "provider": "sandbox",\n  "currency": "CNY"\n}', version: 2, created: 2 }, { key: 'app.display_name', value: 'DUBI Store · 测试', version: 1, created: 1 }],
  website: [{ key: 'site.title', value: 'DUBI · 分布式数据基础设施', version: 1, created: 1 }],
  'internal-tools': [{ key: 'app.display_name', value: '团队工作台', version: 1, created: 1 }], sandbox: [], 'cache-only': [],
};
const byteCount = (value: string) => new TextEncoder().encode(value).length;
const size = (value: string) => byteCount(value) < 1024 ? `${byteCount(value)} B` : `${(byteCount(value) / 1024).toFixed(1)} KiB`;
function TenantIdentity({ tenant }: { tenant: BusinessTenant }) { return <div className="config-tenant-identity"><Icon name="tenant" size={16}/><strong>{tenant.name}</strong><code>{tenant.id}</code></div>; }
function TenantDetail({ tenant, onClose }: { tenant: BusinessTenant; onClose: () => void }) {
  const drawer = useDrawer(onClose);
  return <dialog ref={drawer.dialog} className={`inspect-drawer${drawer.closing ? ' is-closing' : ''}`} onAnimationEnd={drawer.onAnimationEnd} onClick={drawer.onBackdropClick} onCancel={event => { event.preventDefault(); drawer.requestClose(); }} aria-labelledby="business-tenant-title"><header className="drawer-header"><div><div className="eyebrow">当前租户</div><h2 id="business-tenant-title">{tenant.name}</h2><p>{tenant.id}</p></div><button className="icon-button" aria-label="关闭租户详情" onClick={drawer.requestClose} autoFocus><Icon name="close"/></button></header><div className="drawer-body"><h3>基本信息</h3><dl className="detail-fields"><dt>租户名称</dt><dd>{tenant.name}</dd><dt>租户标识</dt><dd><code>{tenant.id}</code></dd><dt>允许访问</dt><dd>{tenant.modules.map(id => id === 'config' ? '配置中心' : '分布式缓存').join('、')}</dd></dl><p className="detail-help">此租户的业务数据独立保存，同名 Key 不会与其他租户混用。</p></div><footer className="drawer-footer">界面预览 · 租户信息为示例</footer></dialog>;
}
export function BusinessTenantPreview({ tenantID, moduleID, onSelect }: { tenantID: string; moduleID: string; onSelect: (id: string) => void }) {
  const [details, setDetails] = useState<BusinessTenant | null>(null);
  return <><BusinessTenantBar tenants={tenants} tenantID={tenantID} moduleID={moduleID} onSelect={onSelect} onDetails={setDetails}/>{details && <TenantDetail tenant={details} onClose={() => setDetails(null)}/>}</>;
}
function ConfigDetails({ entry, tenant, onClose, onEdit, onDelete }: { entry: ConfigEntry; tenant: BusinessTenant; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const drawer = useDrawer(onClose);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  return <dialog ref={drawer.dialog} className={`inspect-drawer config-drawer${drawer.closing ? ' is-closing' : ''}`} onAnimationEnd={drawer.onAnimationEnd} onClick={drawer.onBackdropClick} onCancel={event => { event.preventDefault(); drawer.requestClose(); }} aria-labelledby="config-detail-title"><header className="drawer-header"><div><div className="eyebrow">配置详情</div><h2 id="config-detail-title">{entry.key}</h2><p>版本 v{entry.version}</p></div><button className="icon-button" aria-label="关闭配置详情" onClick={drawer.requestClose} autoFocus><Icon name="close"/></button></header><div className="drawer-body"><TenantIdentity tenant={tenant}/><h3>基本信息</h3><dl className="detail-fields"><dt>配置 Key</dt><dd><code>{entry.key}</code></dd><dt>内容大小</dt><dd>{size(entry.value)}</dd><dt>当前版本</dt><dd><span className="config-version">v{entry.version}</span></dd></dl><div className="config-value-heading"><h3>配置内容</h3><button className="text-button" onClick={async () => { try { await navigator.clipboard.writeText(entry.value); setCopied(true); setCopyError(false); } catch { setCopyError(true); } }}><Icon name={copied ? 'check' : 'copy'} size={14}/>{copied ? '已复制' : '复制内容'}</button></div><pre className="config-code">{entry.value}</pre>{copyError && <p className="detail-help" role="status">浏览器不允许复制，请选中内容手动复制。</p>}<p className="detail-help">修改时校验当前版本，避免覆盖其他人的更新。</p></div><footer className="drawer-footer config-drawer-footer"><button className="config-danger-button" onClick={onDelete}>删除配置</button><button className="config-primary-button" onClick={onEdit}>编辑配置</button></footer></dialog>;
}
function ConfigEditor({ entry, tenant, onClose, onSave }: { entry?: ConfigEntry; tenant: BusinessTenant; onClose: () => void; onSave: (key: string, value: string) => string | null }) {
  const [key, setKey] = useState(entry?.key ?? '');
  const [value, setValue] = useState(entry?.value ?? '');
  const [mode, setMode] = useState('text');
  const [error, setError] = useState('');
  function validJSON() { try { JSON.parse(value); return true; } catch { setError('内容不是有效的 JSON，请检查后再保存。'); return false; } }
  return <PreviewDialog title={entry ? '编辑配置' : '新增配置'} description={entry ? `基于当前版本 v${entry.version} 保存修改。` : '为当前租户添加一个配置项。'} onClose={onClose} footer={<><small>界面预览 · 不写入集群</small><button className="outline-button" onClick={onClose}>取消</button><button className="config-primary-button" type="submit" form="config-editor">{entry ? '保存修改' : '创建配置'}</button></>}><form id="config-editor" onSubmit={event => { event.preventDefault(); if (!key.trim() || byteCount(key) > 2048) { setError('Key 不能为空，且不能超过 2 KiB。'); return; } if (byteCount(value) > 65536) { setError('配置内容不能超过 64 KiB。'); return; } if (mode === 'json' && !validJSON()) return; setError(onSave(key, value) ?? ''); }}><TenantIdentity tenant={tenant}/><label htmlFor="config-key">配置 Key</label><input id="config-key" value={key} onChange={event => { setKey(event.target.value); setError(''); }} readOnly={!!entry} placeholder="例如 app.display_name" required autoComplete="off"/><p className="preview-form-help">同一租户内唯一，创建后保持不变。</p><div className="config-editor-toolbar"><label htmlFor="config-value">配置内容</label><Select label="编辑格式" value={mode} onChange={setMode} options={[{ value: 'text', label: '纯文本' }, { value: 'json', label: 'JSON' }]}/>{mode === 'json' && <button type="button" className="text-button" onClick={() => { if (validJSON()) { setValue(JSON.stringify(JSON.parse(value), null, 2)); setError(''); } }}>格式化</button>}</div><textarea id="config-value" className="config-editor-value" value={value} onChange={event => { setValue(event.target.value); setError(''); }} spellCheck={false} placeholder="输入配置内容…"/><div className="config-editor-caption"><span>按原始文本保存，JSON 格式仅用于编辑校验。</span><span>{size(value)} / 64 KiB</span></div>{error && <p className="preview-form-error" role="alert">{error}</p>}</form></PreviewDialog>;
}
function DeleteConfig({ entry, tenant, onClose, onDelete }: { entry: ConfigEntry; tenant: BusinessTenant; onClose: () => void; onDelete: () => void }) {
  return <PreviewDialog title="删除配置" description="删除后，应用将无法再读取此配置。" onClose={onClose} footer={<><small>仅删除当前预览数据</small><button className="outline-button" onClick={onClose}>取消</button><button className="config-delete-button" onClick={onDelete}>确认删除</button></>}><TenantIdentity tenant={tenant}/><dl className="detail-fields"><dt>配置 Key</dt><dd><code>{entry.key}</code></dd><dt>当前版本</dt><dd>v{entry.version}</dd></dl><p className="detail-help">只删除上述租户中的配置，不影响其他租户的同名 Key。</p></PreviewDialog>;
}
function ConfigWorkspace({ tenant, entries, onChange }: { tenant: BusinessTenant; entries: ConfigEntry[]; onChange: (items: ConfigEntry[]) => void }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState('10');
  const [selection, setSelection] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ key?: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const setNotice = toast.success;
  const filtered = [...entries].sort((a, b) => b.created - a.created).filter(entry => entry.key.toLowerCase().includes(query.trim().toLowerCase()));
  const offset = Math.min(page, Math.max(0, Math.ceil(filtered.length / Number(limit)) - 1));
  const rows = filtered.slice(offset * Number(limit), (offset + 1) * Number(limit));
  const selected = entries.find(entry => entry.key === selection);
  const removed = entries.find(entry => entry.key === deleting);
  const editingEntry = editing?.key === undefined ? undefined : entries.find(entry => entry.key === editing.key);
  function save(key: string, value: string) {
    if (!editingEntry && entries.some(entry => entry.key === key)) return '当前租户已存在此 Key，请使用其他 Key 或编辑已有配置。';
    const next = editingEntry ? { ...editingEntry, value, version: editingEntry.version + 1 } : { key, value, version: 1, created: Math.max(0, ...entries.map(entry => entry.created)) + 1 };
    onChange(editingEntry ? entries.map(entry => entry.key === key ? next : entry) : [next, ...entries]);
    setEditing(null); setQuery(''); setPage(0); setNotice(editingEntry ? '配置已更新，仅在当前预览中生效。' : '配置已创建，仅在当前预览中生效。'); return null;
  }
  return <>
    <div className="config-summary"><span>配置项 <strong>{entries.length}</strong></span><span>内容总量 <strong>{size(entries.map(entry => entry.value).join(''))}</strong></span><span>单项上限 <strong>64 KiB</strong></span></div>
    <section className="panel config-panel"><div className="panel-heading"><div><h2>配置列表 <span>{entries.length}</span></h2><p>管理应用配置，按创建时间倒序排列。</p></div><button className="config-primary-button" onClick={() => setEditing({})}><Icon name="plus" size={15}/>新增配置</button></div><div className="config-list-toolbar"><label className="search-field"><Icon name="search" size={16}/><input aria-label="搜索配置 Key" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="搜索配置 Key…"/>{query && <button aria-label="清空搜索" onClick={() => setQuery('')}><Icon name="close" size={13}/></button>}</label><span>当前租户：{tenant.name}</span></div>
    <div className="table-scroll"><table className="dense-table config-table"><thead><tr><th>配置 Key</th><th>配置内容</th><th>大小</th><th>版本</th><th>操作</th></tr></thead><tbody>{rows.map(entry => <tr key={entry.key}><td><button className="resource-link" onClick={() => setSelection(entry.key)}><Icon name="config" size={16}/><code>{entry.key}</code></button></td><td><span className="config-value-preview" title="点击详情查看完整内容">{entry.value.replace(/\s+/g, ' ') || '空值'}</span></td><td>{size(entry.value)}</td><td><span className="config-version">v{entry.version}</span></td><td><div className="config-row-actions"><button className="text-button" aria-label={`编辑配置 ${entry.key}`} onClick={() => setEditing({ key: entry.key })}>编辑</button><button className="config-danger-button" aria-label={`删除配置 ${entry.key}`} onClick={() => setDeleting(entry.key)}>删除</button><button className="text-button" aria-label={`查看配置 ${entry.key}`} onClick={() => setSelection(entry.key)}>详情<Icon name="arrow" size={12}/></button></div></td></tr>)}</tbody></table></div>
    {!rows.length && <div className="config-empty"><Icon name={query ? 'search' : 'config'} size={28}/><h3>{query ? '未找到匹配的配置' : '还没有配置项'}</h3><p>{query ? '换一个 Key 关键词试试。' : '添加第一个配置，供当前租户的应用读取。'}</p>{!query && <button className="outline-button" onClick={() => setEditing({})}>新增配置</button>}</div>}
    <div className="pagination"><span>共 {filtered.length} 项 · 第 {offset + 1} 页</span><Select label="每页配置条数" value={limit} onChange={value => { setLimit(value); setPage(0); }} options={['5', '10', '20'].map(value => ({ value, label: `每页 ${value} 条` }))}/><button className="outline-button" disabled={offset === 0} onClick={() => setPage(offset - 1)}>上一页</button><button className="outline-button" disabled={(offset + 1) * Number(limit) >= filtered.length} onClick={() => setPage(offset + 1)}>下一页</button></div></section>

    {selected && <ConfigDetails key={selected.key} entry={selected} tenant={tenant} onClose={() => setSelection(null)} onEdit={() => setEditing({ key: selected.key })} onDelete={() => { setSelection(null); setDeleting(selected.key); }}/>}
    {editing !== null && <ConfigEditor key={editing.key ?? 'new-config'} entry={editingEntry} tenant={tenant} onClose={() => setEditing(null)} onSave={save}/>}
    {removed && <DeleteConfig entry={removed} tenant={tenant} onClose={() => setDeleting(null)} onDelete={() => { onChange(entries.filter(entry => entry.key !== removed.key)); setDeleting(null); setSelection(null); setNotice('配置已删除，仅在当前预览中生效。'); }}/>}
  </>;
}
export default function BusinessDataPreview({ tenantID, moduleID }: { tenantID: string; moduleID: string }) {
  const [data, setData] = useState(initial);
  const tenant = tenants.find(item => item.id === tenantID);
  if (!tenant) return <section className="panel config-empty"><Icon name="tenant" size={30}/><h3>{tenantID ? '当前租户不可用' : '先选择一个租户'}</h3><p>{tenantID ? '请通过上方租户栏选择可访问的租户。' : '通过上方租户栏选择后，即可查看和管理业务数据。'}</p></section>;
  if (!tenant.modules.includes(moduleID)) return <section className="panel config-empty"><Icon name="shield" size={30}/><h3>此租户未开通{moduleID === 'config' ? '配置中心' : '分布式缓存'}</h3><p>{tenant.name} · {tenant.id}</p><p>可切换租户，或在“租户与配额”中调整模块权限。</p></section>;
  if (moduleID === 'cache') return <section className="panel config-empty"><Icon name="cache" size={30}/><h3>分布式缓存</h3><p>当前租户：{tenant.name} · {tenant.id}</p><p>缓存数据页面尚未开放，已保留统一的租户上下文。</p></section>;
  return <ConfigWorkspace key={tenantID} tenant={tenant} entries={data[tenantID] ?? []} onChange={items => setData(current => ({ ...current, [tenantID]: items }))}/>;
}
