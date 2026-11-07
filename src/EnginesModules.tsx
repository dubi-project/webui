import { toast } from './components/Toast';
import { useState } from 'react';
import Icon from './Icon';
import type { IconName } from './Icon';
import useDrawer from './components/useDrawer';
import PreviewDialog from './components/PreviewDialog';
import './engines-modules.css';

export interface ComponentEntry {
  id: string;
  kind: 'engine' | 'module';
  name: string;
  subtitle: string;
  description: string;
  icon: IconName;
  state: 'registered' | 'healthy' | 'development' | 'planned';
  capabilities: string[];
  engines: string[];
  metrics?: { requests: string; latency: string; errors: string; tenants?: number };
  settings: { label: string; value: string }[];
}
const states = { registered: '已接入', healthy: '运行中', development: '开发中', planned: '未接入' };
function Status({ state }: { state: ComponentEntry['state'] }) {
  return <span className={`component-status component-status-${state}`}><i/>{states[state]}</span>;
}
function Relations({ entry, entries, onSelect }: { entry: ComponentEntry; entries: ComponentEntry[]; onSelect: (id: string) => void }) {
  const related = entries.filter(item => entry.kind === 'engine' ? item.kind === 'module' && item.engines.includes(entry.id) : entry.engines.includes(item.id));
  return <div className="component-relations">{related.length ? related.map(item => <button key={item.id} onClick={() => onSelect(item.id)} aria-label={`查看${item.name}`} title={`查看${item.name}`}><Icon name={item.icon} size={14}/>{item.name}</button>) : <span className="component-muted">暂无关联模块</span>}</div>;
}
function Details({ entry, entries, preview, onSelect, onClose, onEdit }: { entry: ComponentEntry; entries: ComponentEntry[]; preview: boolean; onSelect: (id: string) => void; onClose: () => void; onEdit?: () => void }) {
  const { dialog, closing, requestClose, onBackdropClick, onAnimationEnd } = useDrawer(onClose);
  return <dialog ref={dialog} className={`inspect-drawer component-drawer${closing ? ' is-closing' : ''}`} aria-labelledby="component-detail-title" onClick={onBackdropClick} onAnimationEnd={onAnimationEnd} onCancel={event => { event.preventDefault(); requestClose(); }}>
    <header className="drawer-header"><div><div className="eyebrow">{entry.kind === 'engine' ? '引擎详情' : '模块详情'}</div><h2 id="component-detail-title">{entry.name}</h2><p>{entry.subtitle} · {entry.id}</p></div><button className="icon-button" onClick={requestClose} aria-label="关闭详情" autoFocus><Icon name="close"/></button></header>
    <div className="drawer-body"><div className="component-detail-lead"><Status state={entry.state}/><p>{entry.description}</p></div>
      <h3>基本信息</h3><dl className="detail-fields"><dt>标识</dt><dd><code>{entry.id}</code></dd><dt>管理范围</dt><dd>全局</dd><dt>数据隔离</dt><dd>按租户与模块独立隔离</dd><dt>接入情况</dt><dd>{(entry.state === 'healthy' || entry.state === 'registered') ? '已接入' : entry.state === 'development' ? '开发验证阶段' : '尚未接入集群'}</dd></dl>
      <h3>{(entry.state === 'healthy' || entry.state === 'registered') ? '主要能力' : '规划能力'}</h3><div className="component-capabilities">{entry.capabilities.map(value => <span key={value}><Icon name={(entry.state === 'healthy' || entry.state === 'registered') ? 'check' : 'clock'} size={13}/>{value}</span>)}</div>
      <h3>{entry.kind === 'engine' ? '关联模块' : '依赖引擎'}</h3><Relations entry={entry} entries={entries} onSelect={onSelect}/>{entry.kind === 'engine' && <p className="detail-help">关联关系包含尚未接入的模块，点击可查看各自状态。</p>}
      <section className="component-detail-section"><h3>运行指标 <small>最近 5 分钟</small></h3>{entry.metrics ? <div className="component-detail-metrics"><div><span>请求速率</span><strong>{entry.metrics.requests}<small> /s</small></strong></div><div><span>P95 延迟</span><strong>{entry.metrics.latency}<small> ms</small></strong></div><div><span>错误率</span><strong>{entry.metrics.errors}<small> %</small></strong></div>{entry.metrics.tenants !== undefined && <div><span>接入租户</span><strong>{entry.metrics.tenants}</strong></div>}</div> : <p className="component-no-data">尚无运行指标</p>}</section>
      <section className="component-detail-section"><h3>配置信息</h3>{entry.settings.length ? <dl className="detail-fields">{entry.settings.map(item => <div className="component-setting" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl> : <p className="component-no-data">暂无可配置项</p>}<p className="detail-help">引擎和模块共用底座的存储、数据分布与故障恢复能力。</p></section>
    </div><footer className="drawer-footer component-drawer-footer"><span>{preview ? '界面预览 · 指标为示例数据' : '已接入表示组件已注册，不代表运行健康检查'}</span>{onEdit && <button className="outline-button" onClick={onEdit}>编辑信息</button>}</footer>
  </dialog>;
}
function EditInfo({ entry, onSave, onClose }: { entry: ComponentEntry; onSave: (name: string, description: string) => void; onClose: () => void }) {
  const [name, setName] = useState(entry.name);
  const [description, setDescription] = useState(entry.description);
  return <PreviewDialog title={`编辑${entry.kind === 'engine' ? '引擎' : '模块'}信息`} description="调整展示名称和说明，标识与依赖关系保持不变。" onClose={onClose} footer={<><small>仅用于界面预览</small><button className="outline-button" onClick={onClose}>取消</button><button className="component-primary-button" type="submit" form="component-edit">保存</button></>}>
    <form id="component-edit" onSubmit={event => { event.preventDefault(); if (name.trim() && description.trim()) onSave(name.trim(), description.trim()); }}><label htmlFor="component-id">标识</label><input id="component-id" value={entry.id} readOnly/><label htmlFor="component-name">展示名称</label><input id="component-name" value={name} onChange={event => setName(event.target.value)} required maxLength={40} pattern=".*\S.*"/><label htmlFor="component-description">说明</label><textarea id="component-description" className="component-description-input" value={description} onChange={event => setDescription(event.target.value)} required maxLength={200}/><p className="preview-form-help">名称与说明的编辑为交互预览，尚未保存到集群。</p></form>
  </PreviewDialog>;
}
export default function EnginesModules({ entries, preview = false, onUpdate }: { entries: ComponentEntry[]; preview?: boolean; onUpdate?: (entry: ComponentEntry) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const setNotice = toast.success;
  const current = entries.find(item => item.id === selected);
  return <div className="components-page">

    {(['engine', 'module'] as const).map(kind => {
      const items = entries.filter(item => item.kind === kind);
      return <section className="component-section" key={kind} aria-labelledby={`${kind}-heading`}><div className="component-section-heading"><div><h2 id={`${kind}-heading`}>{kind === 'engine' ? '引擎' : '模块'}<span>{items.length}</span></h2><p>{kind === 'engine' ? '可复用的存储与查询能力' : '面向业务的功能与服务'}</p></div>{items.length > 0 && <span className="component-section-summary">{items.filter(item => item.state === 'healthy' || item.state === 'registered').length} 个已接入</span>}</div>
        {items.length ? <div className="component-grid">{items.map(entry => <article className="component-card" key={entry.id}><div className="component-card-heading"><span className={`component-symbol ${entry.kind}`}><Icon name={entry.icon} size={21}/></span><div><h3>{entry.name}</h3><span>{entry.subtitle}</span></div><Status state={entry.state}/></div><p className="component-description">{entry.description}</p><div className="component-tags">{entry.capabilities.slice(0, 3).map(value => <span key={value}>{value}</span>)}</div><div className="component-card-relation"><span>{kind === 'engine' ? '关联模块' : '依赖引擎'}</span><strong>{entries.filter(item => kind === 'engine' ? item.kind === 'module' && item.engines.includes(entry.id) : entry.engines.includes(item.id)).map(item => item.name).join('、') || '—'}</strong></div><div className="component-card-metrics">{entry.metrics ? <><span>{kind === 'module' ? '接入租户' : '请求 /s'}<strong>{kind === 'module' ? entry.metrics.tenants ?? '—' : entry.metrics.requests}</strong></span><span>P95 延迟<strong>{entry.metrics.latency}<small> ms</small></strong></span></> : <span className="component-awaiting"><Icon name="clock" size={14}/>{entry.state === 'registered' ? '运行指标暂无数据' : entry.state === 'development' ? '开发验证阶段' : '等待接入'}</span>}</div><footer><code>{entry.id}</code><button className="text-button" aria-label={`查看${entry.name}详情`} onClick={() => { setSelected(entry.id); setEditing(false); }}>详情<Icon name="arrow" size={13}/></button></footer></article>)}</div> : <div className="panel component-empty"><Icon name={kind === 'engine' ? 'engines' : 'grid'} size={26}/><h3>暂无已接入的{kind === 'engine' ? '引擎' : '模块'}</h3><p>接入后将在这里展示。</p></div>}
      </section>;
    })}
    {current && <Details entry={current} entries={entries} preview={preview} onSelect={id => { setSelected(id); setEditing(false); }} onClose={() => { setSelected(null); setEditing(false); }} onEdit={preview && onUpdate ? () => setEditing(true) : undefined}/>}
    {current && editing && preview && onUpdate && <EditInfo key={current.id} entry={current} onClose={() => setEditing(false)} onSave={(name, description) => { onUpdate({ ...current, name, description }); setEditing(false); setNotice('展示信息已更新，仅在当前预览中生效。'); }}/>}
  </div>;
}
