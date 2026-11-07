import { useState } from 'react';
import useDrawer from './components/useDrawer';
import Icon from './Icon';
import Select from './components/Select';
import { volumeStatusOptions } from './management/VolumeDetails';
import { Badge as StatusBadge } from './management/components';
import type { IconName } from './Icon';
import { previewNodes, regions, stateLabels } from './preview-data';
import type { NodeState, PreviewNode } from './preview-data';

function Badge({ state, children }: { state: NodeState; children?: React.ReactNode }) {
  return <span className={`status state-${state}`}><i/>{children ?? stateLabels[state]}</span>;
}
function Capacity({ node }: { node: PreviewNode }) {
  if (node.used === null || node.capacity === null) return <span className="unknown-value">未知 <small>未获得当前观测</small></span>;
  const percent = node.used / node.capacity * 100;
  return <div className={`capacity-cell ${node.state === 'warning' ? 'capacity-warning' : ''}`}>
    <div><span className="mono">{node.used.toFixed(1)} <small>/ {node.capacity} GB</small></span><span>{percent.toFixed(1)}%</span></div>
    <div className="meter"><span style={{ width: `${percent}%` }}/></div>
  </div>;
}
function PreviewVolumeDrawer({ node, onClose }: { node: PreviewNode; onClose: () => void }) {
  const { dialog, closing, requestClose, onAnimationEnd } = useDrawer(onClose);
  return <dialog ref={dialog} className={`inspect-drawer${closing ? ' is-closing' : ''}`} aria-labelledby="preview-volume-title" onAnimationEnd={onAnimationEnd} onCancel={event => { event.preventDefault(); requestClose(); }} onClick={event => { if (event.target === event.currentTarget && event.clientX < event.currentTarget.getBoundingClientRect().left) requestClose(); }}>
    <header className="drawer-header"><div><div className="eyebrow">Volume 详情 · 演示数据</div><h2 id="preview-volume-title">{node.state === 'unavailable' ? 'Volume 信息未知' : node.volumeId}</h2><p>{node.id} / {node.region.name}</p></div><button className="icon-button" aria-label="关闭 Volume 详情" onClick={requestClose} autoFocus><Icon name="close"/></button></header>
    <div className="drawer-body">{node.state === 'unavailable' ? <div className="drawer-empty"><h3>暂时无法获取 Volume 信息</h3><p>所属节点当前不可达。</p></div> : <><h3>容量与使用</h3><div className="drawer-capacity"><Capacity node={node}/></div><h3 style={{ marginTop: 28 }}>基本信息</h3><dl className="detail-fields"><dt>Volume ID</dt><dd>{node.volumeId}</dd><dt>路径</dt><dd><code>/var/lib/dubi/volume</code></dd><dt>所属节点</dt><dd>{node.id}</dd><dt>所属区域</dt><dd>{node.region.name}</dd><dt>使用状态</dt><dd>使用中</dd><dt>写入隔离</dt><dd>未隔离</dd><dt>状态</dt><dd><Badge state="healthy">正常</Badge></dd></dl></>}</div>
  </dialog>;
}
function NodeDrawer({ node, initialTab, onClose }: { node: PreviewNode; initialTab: string; onClose: () => void }) {
  const { dialog, closing, requestClose, onAnimationEnd } = useDrawer(onClose);
  const [tab, setTab] = useState(initialTab);

  return <dialog className={`inspect-drawer${closing ? ' is-closing' : ''}`} onAnimationEnd={onAnimationEnd} ref={dialog} aria-labelledby="inspect-title" onCancel={event => { event.preventDefault(); requestClose(); }} onClick={event => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right) requestClose(); } }}>
    <header className="drawer-header"><div><div className="eyebrow">节点详情 · 演示数据</div><h2 id="inspect-title">{node.id} <Badge state={node.state}/></h2><p>{node.region.name} <span>/</span> <code>{node.address}</code></p></div><button className="icon-button" aria-label="关闭节点详情" onClick={requestClose} autoFocus><Icon name="close"/></button></header>
    <div className="drawer-tabs" role="tablist" aria-label="节点详情分类">{[['overview', '概览'], ['volumes', 'Volume'], ['maintenance', '维护状态']].map(([id, label]) => <button key={id} id={`tab-${id}`} role="tab" aria-selected={tab === id} aria-controls="node-tab-panel" tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={event => {
      const ids = ['overview', 'volumes', 'maintenance'];
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (ids.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
        setTab(ids[next]); document.getElementById(`tab-${ids[next]}`)?.focus();
      }
    }}>{label}</button>)}</div>
    <div className="drawer-body" role="tabpanel" id="node-tab-panel" aria-labelledby={`tab-${tab}`}>
      {node.state !== 'healthy' && <div className={`detail-notice ${node.state}`}><Icon name="alert" size={18}/><div><strong>{node.state === 'unavailable' ? '当前无法获取节点观测' : '存储使用率较高'}</strong><p>{node.state === 'unavailable' ? '节点仍保留在成员列表中。容量、Volume 和维护状态标记为未知。' : '当前使用 52.8 / 60 GB（88%）。请检查容量分布与可用空间。'}</p></div></div>}
      {tab === 'overview' && <><h3>基本信息</h3><dl className="detail-fields"><dt>节点名称</dt><dd>{node.id}</dd><dt>Node ID</dt><dd><code>demo-node-{node.id}</code></dd><dt>所属区域</dt><dd>{node.region.name}</dd><dt>节点地址</dt><dd><code>{node.address}</code></dd><dt>观测状态</dt><dd>{node.state === 'unavailable' ? '不完整 · 节点不可达' : '已获得当前观测'}</dd><dt>Volume 数量</dt><dd>{node.state === 'unavailable' ? '未知' : '1'}</dd></dl><h3>节点存储</h3><div className="drawer-capacity"><Capacity node={node}/></div><p className="detail-help">容量为节点文件系统观测，不代表集群去重后的业务数据量。</p></>}
      {tab === 'volumes' && <><h3>Volume 信息</h3>{node.state === 'unavailable' ? <div className="drawer-empty"><Icon name="volume" size={30}/><h3>Volume 状态未知</h3><p>无法获得节点当前数据，暂不显示历史容量或健康状态。</p></div> : <div className="volume-inspect"><div><code>{node.volumeId}</code><Badge state="healthy">健康</Badge></div><dl className="detail-fields"><dt>路径</dt><dd><code>/var/lib/dubi/volume</code></dd><dt>写入隔离</dt><dd>未隔离</dd></dl><Capacity node={node}/><p className="detail-help">{node.state === 'warning' ? '文件系统可访问，容量预警与介质故障分别展示。' : '此 Volume 由节点统一管理。'}</p></div>}</>}
      {tab === 'maintenance' && <><h3>维护观测</h3>{['Repair', 'Rebalance', '跨区域同步'].map(item => <div className="drawer-task" key={item}><span>{item}</span>{node.state === 'unavailable' ? <span className="unknown-value">未知</span> : <Badge state="healthy">空闲</Badge>}</div>)}<p className="detail-help">维护进度只显示实际可观测的阶段，不用百分比推算数据完整性。</p></>}
      <details className="technical-details"><summary>技术信息</summary><pre>{JSON.stringify({ source: 'design-preview', node_id: `demo-node-${node.id}`, region_id: node.region.id, state: node.state, capacity_known: node.capacity !== null }, null, 2)}</pre></details>
    </div><footer className="drawer-footer">只读预览 · 不会更改集群或节点</footer>
  </dialog>;
}

export default function PreviewWorkspace({ page, onNavigate }: { page: IconName; onNavigate: (page: IconName) => void }) {
  const [incident, setIncident] = useState(false);
  const [query, setQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [selected, setSelected] = useState<{ id: string; tab: string } | null>(null);
  const [volumeNode, setVolumeNode] = useState('');
  const [volumeStatus, setVolumeStatus] = useState('');
  const nodes = previewNodes(incident);
  const online = nodes.filter(node => node.state !== 'unavailable');
  const used = online.reduce((total, node) => total + (node.used ?? 0), 0);
  const capacity = online.reduce((total, node) => total + (node.capacity ?? 0), 0);
  const visible = nodes.filter(node => {
    const search = query.trim().toLowerCase();
    return [node.id, node.address, node.region.name, node.region.label, node.volumeId].join(' ').toLowerCase().includes(search)
      && (regionFilter === 'all' || node.region.code === regionFilter)
      && (page === 'volume' ? ((!volumeNode || node.id === volumeNode) && (!volumeStatus || (node.state === 'unavailable' ? 'unknown' : 'healthy') === volumeStatus)) : (stateFilter === 'all' || (stateFilter === 'attention' ? node.state !== 'healthy' : node.state === stateFilter)));
  });
  const selectedNode = nodes.find(node => node.id === selected?.id);
  function inspect(node: PreviewNode, tab = 'overview') { setSelected({ id: node.id, tab }); }
  function regionNavigate(code: string) { setRegionFilter(code); setQuery(''); setStateFilter('all'); onNavigate('globe'); }
  function clearFilters() { setQuery(''); setRegionFilter('all'); setStateFilter('all'); setVolumeNode(''); setVolumeStatus(''); }
  function toolbar() {
    if (page === 'volume') return <div className="list-toolbar"><Select label="筛选 Volume 所属区域" value={regionFilter} onChange={value => { setRegionFilter(value); setVolumeNode(''); setQuery(''); }} options={[{ value: 'all', label: '全部区域' }, ...regions.map(region => ({ value: region.code, label: region.name }))]}/><Select label="筛选 Volume 所属节点" disabled={regionFilter === 'all'} value={volumeNode} onChange={setVolumeNode} options={[{ value: '', label: regionFilter === 'all' ? '请先选择区域' : '全部节点' }, ...nodes.filter(node => node.region.code === regionFilter).map(node => ({ value: node.id, label: node.id }))]}/><Select label="筛选 Volume 状态" value={volumeStatus} onChange={setVolumeStatus} options={volumeStatusOptions}/>{(regionFilter !== 'all' || volumeNode || volumeStatus) && <button className="text-button" onClick={clearFilters}>清除筛选</button>}</div>;
    return <div className="list-toolbar"><label className="search-field"><Icon name="search" size={18}/><input aria-label="搜索节点或 Volume" placeholder="搜索名称、地址、区域…" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button aria-label="清空搜索" onClick={() => setQuery('')}><Icon name="close" size={14}/></button>}</label><Select label="筛选区域" value={regionFilter} onChange={setRegionFilter} options={[{ value: 'all', label: '全部区域' }, ...regions.map(region => ({ value: region.code, label: region.name }))]}/><Select label="筛选状态" value={stateFilter} onChange={setStateFilter} options={[{ value: 'all', label: '全部节点状态' }, { value: 'healthy', label: '在线 · 无预警' }, { value: 'attention', label: '需关注' }, { value: 'warning', label: '容量预警' }, { value: 'unavailable', label: '不可达' }]}/><span className="result-count" role="status">{visible.length} / {nodes.length} 个节点</span></div>; }
  function empty() { return <div className="list-empty"><Icon name="search" size={26}/><h3>没有匹配的节点</h3><p>试试其他名称，或清除区域和状态筛选。</p><button className="outline-button" onClick={clearFilters}>清除筛选</button></div>; }
  function nodeTable(items: PreviewNode[]) { return <div className="table-scroll"><table className="dense-table"><thead><tr><th>节点 / 地址</th><th>区域</th><th>Volume</th><th>存储使用</th><th>状态</th><th>操作</th></tr></thead><tbody>{items.map(node => <tr key={node.id} className={node.state !== 'healthy' ? `row-${node.state}` : ''}><td><button className="resource-link" onClick={() => inspect(node)}><Icon name="server" size={17}/>{node.id}</button><code className="cell-secondary">{node.address}</code></td><td>{node.region.name}</td><td>{node.state === 'unavailable' ? '—' : '1'}</td><td><Capacity node={node}/></td><td><Badge state={node.state}/></td><td><button className="text-button" onClick={() => inspect(node)} aria-label={`查看 ${node.id} 详情`}>详情<Icon name="arrow" size={13}/></button></td></tr>)}</tbody></table></div>; }
  function topology() { return <div className="region-grid topology-grid">{regions.map(region => {
    const members = nodes.filter(node => node.region.code === region.code);
    const reachable = members.filter(node => node.state !== 'unavailable');
    const issues = members.some(node => node.state !== 'healthy');
    return <article className={`region-card topology-card ${issues ? 'has-attention' : ''}`} key={region.code}>
      <div className="topology-heading"><span className="region-code">{region.code}</span><div><h3>{region.name}</h3><p>{region.label} · {reachable.length} / 3 节点在线</p></div><Badge state={issues ? 'warning' : 'healthy'}>{issues ? '需关注' : '正常'}</Badge></div>
      <div className="region-state-counts">{(['healthy', 'degraded', 'unavailable', 'unknown'] as const).map(status => <StatusBadge key={status} status={status} count={members.filter(node => (node.state === 'warning' ? 'degraded' : node.state) === status).length}/>)}</div>
      <div className="topology-members">{members.map(node => <button className={`topology-member member-${node.state}`} key={node.id} onClick={() => inspect(node)}><div><strong><Icon name="server" size={15}/>{node.id}</strong><Badge state={node.state}/></div><div className="topology-meta"><code>{node.address}</code><Icon name="arrow" size={12}/></div><Capacity node={node}/></button>)}</div>
      <button className="region-link" onClick={() => regionNavigate(region.code)}>查看区域内节点<Icon name="arrow" size={13}/></button>
    </article>;
  })}</div>; }
  return <>
    <div className="preview-controls"><div className="segmented" role="group" aria-label="预览场景"><button aria-pressed={!incident} onClick={() => setIncident(false)}>正常运行</button><button aria-pressed={incident} onClick={() => setIncident(true)}><span className="amber-dot"/>异常示例</button></div><span className="scenario-hint">仅切换演示数据</span></div>
    {page === 'grid' && <>
      <section className={`health-summary ${incident ? 'health-attention' : ''}`}><div className="health-summary-heading"><span className="cluster-symbol"><Icon name={incident ? 'alert' : 'grid'} size={24}/></span><div><h2>{incident ? '集群存在需关注的节点' : '集群运行正常'}</h2><p>dubi-development <span>·</span> {incident ? '1 个节点不可达，1 个节点容量预警' : '全部节点可达，当前观测完整'}</p></div><Badge state={incident ? 'warning' : 'healthy'}>{incident ? '观测不完整' : '观测完整'}</Badge></div><div className="summary-metrics">{[
        { label: '在线节点', value: `${online.length}`, unit: '/ 9', note: incident ? '成员仍保留 9 个节点' : '全部节点在线' },
        { label: '有在线节点的区域', value: '3', unit: '/ 3', note: 'Singapore · Frankfurt · Toronto' },
        { label: '已观测存储用量', value: used.toFixed(1), unit: 'GB', note: `${online.length} / 9 节点 · 已观测容量 ${capacity} GB` },
        { label: '需要关注', value: incident ? '2' : '0', unit: '项', note: incident ? '节点连通性与容量' : '当前无异常观测' },
      ].map(metric => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}<small>{metric.unit}</small></strong><p>{metric.note}</p></div>)}</div></section>
      {incident && <section className="attention-strip" aria-label="需要关注的事项"><span><Icon name="alert" size={17}/>需要关注</span><button onClick={() => inspect(nodes.find(node => node.id === 'ff02')!)}><i className="red-dot"/><strong>ff02</strong> 不可达 <Icon name="arrow" size={12}/></button><button onClick={() => inspect(nodes.find(node => node.id === 'sg03')!, 'volumes')}><i className="amber-dot"/><strong>sg03</strong> 容量 88% <Icon name="arrow" size={12}/></button></section>}
      <section className="section-block"><div className="section-heading"><h2>区域与节点 <span>3 个区域</span></h2><button className="text-button" onClick={() => { clearFilters(); onNavigate('globe'); }}>查看全部节点<Icon name="arrow" size={14}/></button></div>{topology()}</section>
      <div className="overview-bottom"><section className="panel"><div className="panel-heading"><h2>维护观测</h2><button className="text-button" onClick={() => onNavigate('tool')}>查看详情<Icon name="arrow" size={13}/></button></div>{['数据修复', '数据再平衡', '跨区域同步'].map(name => <div className="compact-task" key={name}><Icon name="tool" size={16}/><strong>{name}</strong><span>{online.length} 个节点空闲{incident ? ' · 1 个未知' : ''}</span></div>)}</section><section className="panel"><div className="panel-heading"><h2>观测说明</h2><span className="preview-chip">只读</span></div><div className="observation-notes"><p><strong>容量按文件系统观测汇总</strong><span>不是去重后的业务数据大小。</span></p><p><strong>不可达节点保留成员身份</strong><span>不会因超时自动移除，未获得的数据标记未知。</span></p></div></section></div>
    </>}
    {page === 'globe' && <><section className="section-block">{topology()}</section><div className="panel">{toolbar()}{visible.length ? regions.map(region => {
      const members = visible.filter(node => node.region.code === region.code);
      return members.length ? <section key={region.code}><div className="group-heading"><h3>{region.name}</h3><span>{members.length} 个节点</span></div>{nodeTable(members)}</section> : null;
    }) : empty()}</div></>}
    {page === 'volume' && <><div className="volume-summary"><div><span>已观测容量</span><strong>{capacity} <small>GB</small></strong><p>覆盖 {online.length} / 9 个节点</p></div><div><span>已观测使用量</span><strong>{used.toFixed(1)} <small>GB</small></strong><p>文件系统使用率 {(used / capacity * 100).toFixed(1)}%</p></div><div><span>容量预警</span><strong>{incident ? '1' : '0'} <small>个 Volume</small></strong><p>{incident ? '另有 1 个节点的 Volume 状态未知' : '全部已观测 Volume 无容量预警'}</p></div></div><section className="panel">{toolbar()}{visible.length ? <div className="table-scroll"><table className="dense-table"><thead><tr><th>Volume / 路径</th><th>节点 / 区域</th><th>容量 / 使用</th><th>写入隔离</th><th>状态</th><th>操作</th></tr></thead><tbody>{visible.map(node => <tr key={node.id}><td>{node.state === 'unavailable' ? <span className="unknown-value">Volume 信息未知</span> : <><button className="resource-link" onClick={() => inspect(node, 'volumes')}><Icon name="volume" size={17}/>{node.volumeId}</button><code className="cell-secondary">/var/lib/dubi/volume</code></>}</td><td><strong>{node.id}</strong><span className="cell-secondary">{node.region.name}</span></td><td><Capacity node={node}/></td><td>{node.state === 'unavailable' ? '未知' : '未隔离'}</td><td>{node.state === 'unavailable' ? <span className="unknown-value">未知</span> : <Badge state="healthy">健康</Badge>}</td><td><button className="text-button" onClick={() => inspect(node, 'volumes')} aria-label={`查看 ${node.id} Volume`}>查看<Icon name="arrow" size={13}/></button></td></tr>)}</tbody></table></div> : empty()}<div className="list-footer">Volume 属于节点；未知行表示无法取得该节点的 Volume 列表。</div></section></>}
    {page === 'tool' && <section className="panel"><div className="panel-heading"><h2>按节点查看维护状态</h2><span className="subtle">{online.length} / 9 节点可观测</span></div>{toolbar()}{visible.length ? <div className="table-scroll"><table className="dense-table"><thead><tr><th>节点</th><th>Repair</th><th>Rebalance</th><th>跨区域同步</th><th>操作</th></tr></thead><tbody>{visible.map(node => <tr key={node.id}><td><button className="resource-link" onClick={() => inspect(node, 'maintenance')}>{node.id}</button><span className="cell-secondary">{node.region.name}</span></td>{[1, 2, 3].map(key => <td key={key}>{node.state === 'unavailable' ? <span className="unknown-value">未知</span> : <Badge state="healthy">空闲</Badge>}</td>)}<td><button className="text-button" onClick={() => inspect(node, 'maintenance')}>详情<Icon name="arrow" size={13}/></button></td></tr>)}</tbody></table></div> : empty()}</section>}
    {selectedNode && selected && (selected.tab === 'volumes' ? <PreviewVolumeDrawer key={selected.id} node={selectedNode} onClose={() => setSelected(null)}/> : <NodeDrawer key={`${selected.id}-${selected.tab}`} node={selectedNode} initialTab={selected.tab} onClose={() => setSelected(null)}/>)}
  </>;
}
