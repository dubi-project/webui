import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import UsageMeter from './components/ResourceUsage';
import type { IconName } from './Icon';
import Select from './components/Select';
import PreviewDialog from './components/PreviewDialog';
import useDrawer from './components/useDrawer';
import './monitoring.css';

type Health = 'healthy' | 'warning' | 'unavailable';
type Tab = 'monitor' | 'tasks' | 'diagnostics';
type Node = { id: string; region: string; cpu: number; memory: number; memoryTotal: number; read: number; write: number; latency: number; pending: number; health: Health; added: number };
type Task = { id: string; name: string; kind: string; node: string; started: number; state: 'running' | 'completed' | 'waiting'; count: string; note: string };
type Report = { id: string; scope: string; nodes: string[]; started: number; issues: string[]; checked: number };
type Detail = { type: 'node'; node: Node } | { type: 'task'; task: Task } | { type: 'report'; report: Report };
const regionNames: Record<string, string> = { sg: '新加坡', ff: '法兰克福', tt: '多伦多' };
const healthLabels: Record<Health, string> = { healthy: '正常', warning: '需关注', unavailable: '不可达' };
const time = (n: number) => new Date(n).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
const date = (n: number) => new Date(n).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour12: false, hour: '2-digit', minute: '2-digit' });
function nodes(incident: boolean): Node[] {
  return Object.keys(regionNames).flatMap((region, r) => [1, 2, 3].map(n => ({ id: `${region}0${n}`, region, cpu: 14 + (r * 7 + n * 3) % 24, memory: 164 + r * 13 + n * 9, memoryTotal: 1024, read: 86 + r * 14 + n * 8, write: 31 + r * 6 + n * 5, latency: 18 + r * 4 + n * 2, pending: 0, health: 'healthy' as Health, added: r * 3 + n }))).map(n => incident && n.id === 'ff02' ? { ...n, health: 'unavailable' as Health } : incident && n.id === 'sg03' ? { ...n, cpu: 76, memory: 860, latency: 138, pending: 128, health: 'warning' as Health } : n).sort((a, b) => b.added - a.added);
}
// Preview percentages use process share of the node's total CPU / physical memory.
function ResourceUsage({ node, kind }: { node: Node; kind: 'cpu' | 'memory' }) {
  if (node.health === 'unavailable') return <span className="monitor-muted">—</span>;
  const percent = kind === 'cpu' ? node.cpu : node.memory / node.memoryTotal * 100;
  const label = kind === 'cpu' ? 'CPU 占用' : '内存占用';
  return <UsageMeter label={`${node.id} ${label}`} percent={percent} detail={kind === 'memory' ? `${node.memory} MiB` : undefined} title={kind === 'cpu' ? 'DUBI 进程占节点全部 CPU 容量的比例' : `DUBI 进程内存 ${node.memory} MiB / 节点总内存 ${node.memoryTotal} MiB`}/>;
}
function HealthBadge({ state }: { state: Health }) { return <span className={`status state-${state}`}><i/>{healthLabels[state]}</span>; }
function TaskBadge({ state }: { state: Task['state'] }) { return <span className={`status monitor-task-${state}`}><i/>{({ running: '执行中', waiting: '等待重试', completed: '已完成' })[state]}</span>; }
function seedTasks(now: number, incident: boolean): Task[] {
  const items: Task[] = [
    { id: 'task_00618', name: '数据再平衡', kind: 'rebalance', node: 'tt03', started: now - 38 * 60000, state: 'completed', count: '已迁移 64 个 Range', note: '节点加入后的数据分布已恢复平衡。' },
    { id: 'task_00612', name: 'Pack 空间回收', kind: 'compaction', node: 'sg01', started: now - 75 * 60000, state: 'completed', count: '已整理 12 个 Pack', note: '回收已失效记录占用的存储空间。' },
  ];
  if (incident) items.push(
    { id: 'task_00623', name: '跨区域同步', kind: 'geo_sync', node: 'sg03', started: now - 2 * 60000, state: 'running', count: '待同步 96 条记录', note: '记录已在本区域确认，正在向其他区域同步。' },
    { id: 'task_00622', name: '数据修复', kind: 'repair', node: 'sg03', started: now - 5 * 60000, state: 'running', count: '待修复 32 条记录', note: '正在补齐缺失数据；已扫描 1,024 条记录。' },
    { id: 'task_00621', name: '节点状态检查', kind: 'health', node: 'ff02', started: now - 7 * 60000, state: 'waiting', count: '最近一次请求超时', note: '未取得节点最新状态，保留成员身份并等待重新观测。' },
  );
  return items.sort((a, b) => b.started - a.started);
}

function Trend({ title, unit, names, values, now, minutes, warning }: { title: string; unit: string; names: [string, string]; values: [number, number]; now: number; minutes: number; warning?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const count = 25;
  const series = values.map((v, s) => Array.from({ length: count }, (_, i) => i === count - 1 ? v : Math.max(0, v * (0.86 + Math.sin(i * 1.34 + s + minutes) * .09 + Math.cos(i * .42) * .05 + (warning && i > 18 ? .34 : 0)))));
  const max = Math.max(1, Math.ceil(Math.max(...series.flat()) / 10) * 10);
  const xy = (v: number, i: number) => `${42 + i / (count - 1) * 488},${156 - v / max * 128}`;
  const current = hover ?? count - 1;
  return <section className="panel monitor-chart"><div className="monitor-chart-heading"><h3>{title}</h3><span>{unit}</span></div>
    <div className="monitor-chart-values">{names.map((name, s) => <span key={name}><i className={`series-${s}`}/>{name}<strong>{series[s][current].toFixed(0)}</strong><small>{unit}</small></span>)}<time>{hover === null ? '最近采样' : time(now - (count - 1 - current) / (count - 1) * minutes * 60000)}</time></div>
    <svg viewBox="0 0 550 190" role="img" aria-label={`${title}，最近 ${minutes} 分钟，${names.join('与')}趋势`} onMouseMove={e => { const box = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(count - 1, Math.round(((e.clientX - box.left) / box.width * 550 - 42) / 488 * (count - 1))))); }} onMouseLeave={() => setHover(null)}>
      {[0, 1, 2, 3].map(i => <g key={i}><line x1="42" x2="530" y1={28 + i * 128 / 3} y2={28 + i * 128 / 3} className="chart-grid"/><text x="32" y={32 + i * 128 / 3} textAnchor="end">{Math.round(max * (1 - i / 3))}</text></g>)}
      <polygon points={`42,156 ${series[0].map(xy).join(' ')} 530,156`} fill="#428596" opacity=".06"/>
      {series.map((values, s) => <polyline key={s} points={values.map(xy).join(' ')} fill="none" stroke={s ? '#8db9b7' : '#387e94'} strokeWidth="2" strokeLinejoin="round"/>)}
      {hover !== null && <g><line x1={42 + hover / 24 * 488} x2={42 + hover / 24 * 488} y1="24" y2="156" stroke="#92aab8" strokeDasharray="3 4"/>{series.map((v, s) => <circle key={s} cx={42 + hover / 24 * 488} cy={156 - v[hover] / max * 128} r="3" fill={s ? '#8db9b7' : '#387e94'} stroke="white"/>)}</g>}
      {[0, 1, 2, 3, 4].map(i => <text key={i} x={42 + i * 122} y="180" textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{time(now - (4 - i) / 4 * minutes * 60000)}</text>)}
    </svg>
  </section>;
}

function DetailDrawer({ detail, now, onClose }: { detail: Detail; now: number; onClose: () => void }) {
  const { dialog, closing, requestClose, onAnimationEnd } = useDrawer(onClose);
  const node = detail.type === 'node' ? detail.node : null;
  const task = detail.type === 'task' ? detail.task : null;
  const report = detail.type === 'report' ? detail.report : null;
  const unknown = node?.health === 'unavailable';
  return <dialog ref={dialog} className={`inspect-drawer monitor-drawer${closing ? ' is-closing' : ''}`} aria-labelledby="monitor-detail-title" onAnimationEnd={onAnimationEnd} onCancel={e => { e.preventDefault(); requestClose(); }} onClick={e => { if (e.target === e.currentTarget && e.clientX < e.currentTarget.getBoundingClientRect().left) requestClose(); }}>
    <header className="drawer-header"><div><div className="eyebrow">{node ? '节点监控' : task ? '后台任务' : '诊断记录'}</div><h2 id="monitor-detail-title">{node?.id ?? task?.name ?? report?.id}</h2><p>{node ? regionNames[node.region] : task ? `${task.node} · ${regionNames[task.node.slice(0, 2)]}` : report?.scope}</p></div><button className="icon-button" aria-label="关闭监控详情" autoFocus onClick={requestClose}><Icon name="close"/></button></header>
    <div className="drawer-body">
      {node && <><div className="monitor-detail-summary"><Icon name="server" size={24}/><div><strong>{unknown ? '暂未取得最新观测' : node.health === 'warning' ? '资源与同步需要关注' : '节点运行正常'}</strong><p>{unknown ? '最近成功观测：' + time(now - 7 * 60000) : '最近观测：' + time(now)}</p></div><HealthBadge state={node.health}/></div>
        <div className="monitor-detail-metrics">{[['CPU 使用', `${node.cpu}%`], ['进程内存', `${node.memory} MiB`], ['读请求', `${node.read} 次/秒`], ['写请求', `${node.write} 次/秒`]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{unknown ? '—' : value}</strong></div>)}</div>
        <h3>服务检查</h3><div className="monitor-checks">{[['进程存活', '/healthz'], ['服务就绪', '/readyz'], ['指标采集', '/metrics']].map(([name, path]) => <div key={name}><Icon name={unknown ? 'clock' : 'check'} size={17}/><span><strong>{name}</strong><code>{path}</code></span><span className={unknown ? 'monitor-muted' : 'monitor-ok'}>{unknown ? '未取得结果' : '通过'}</span></div>)}</div>
        <h3>后台维护</h3><dl className="detail-fields"><dt>数据修复</dt><dd>{unknown ? '未知' : node.pending ? '32 条待处理' : '无待处理'}</dd><dt>跨区域同步</dt><dd>{unknown ? '未知' : node.pending ? '96 条待同步' : '无积压'}</dd><dt>数据再平衡</dt><dd>{unknown ? '未知' : '空闲'}</dd></dl>
        {node.health !== 'healthy' && <div className="monitor-advice"><Icon name="alert" size={18}/><div><strong>排查建议</strong><p>{unknown ? '检查节点进程、网络连通性和磁盘状态。无法观测不代表节点已从集群移除。' : '检查磁盘 I/O 和跨区域网络，观察待同步数量是否持续增长。'}</p></div></div>}
      </>}
      {task && <><div className="monitor-detail-summary"><Icon name="tool" size={24}/><div><strong>{task.count}</strong><p>{task.note}</p></div><TaskBadge state={task.state}/></div><h3>任务信息</h3><dl className="detail-fields"><dt>任务标识</dt><dd><code>{task.id}</code></dd><dt>所属节点</dt><dd>{task.node}</dd><dt>所在区域</dt><dd>{regionNames[task.node.slice(0, 2)]}</dd><dt>开始时间</dt><dd>{date(task.started)}</dd><dt>最近观测</dt><dd>{time(now)}</dd></dl><div className="monitor-advice"><Icon name="activity" size={18}/><p>{task.state === 'waiting' ? '当前任务等待重新观测，不会自动移除节点或缩小多数派。' : task.state === 'completed' ? '此任务已经完成，记录保留供排查和回溯。' : '由后台维护流程推进。进度随下一次观测更新。'}</p></div></>}
      {report && <><div className="monitor-detail-summary"><Icon name={report.issues.length ? 'alert' : 'shield'} size={24}/><div><strong>{report.issues.length ? `发现 ${report.issues.length} 项需要关注` : '检查通过'}</strong><p>{date(report.started)} · {report.nodes.length} 个节点</p></div><HealthBadge state={report.issues.length ? 'warning' : 'healthy'}/></div><h3>检查结果</h3><div className="monitor-checks">{['节点可达性', '服务就绪状态', 'Volume 健康', '后台维护状态'].map((name, i) => { const missing = report.checked < report.nodes.length; const attention = missing || (i === 3 && report.issues.length > 0); return <div key={name}><Icon name={attention ? 'alert' : 'check'} size={17}/><span><strong>{name}</strong><small>{report.nodes.join(' · ')}</small></span><span className={attention ? 'monitor-warn' : 'monitor-ok'}>{missing && i > 0 ? '部分未知' : attention ? '需关注' : '通过'}</span></div>; })}</div>{report.issues.length > 0 && <><h3>需要关注</h3>{report.issues.map(issue => <div className="monitor-advice" key={issue}><Icon name="alert" size={18}/><p>{issue}</p></div>)}</>}<p className="monitor-footnote">检查结果反映执行时的观测状态，不会修改节点或集群配置。</p></>}
    </div><footer className="monitor-drawer-footer"><button className="outline-button" onClick={requestClose}>关闭</button></footer>
  </dialog>;
}

export default function MonitoringPreview({ onNavigate }: { onNavigate: (page: IconName) => void }) {
  const [now, setNow] = useState(Date.now);
  const [seedTime] = useState(now);
  const [incident, setIncident] = useState(false);
  const [region, setRegion] = useState(''); const [node, setNode] = useState('');
  const [windowMinutes, setWindowMinutes] = useState('60');
  const [tab, setTab] = useState<Tab>('monitor');
  const [status, setStatus] = useState(''); const [query, setQuery] = useState('');
  const [page, setPage] = useState(0); const [limit, setLimit] = useState('10');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [connection, setConnection] = useState(false); const [checkDialog, setCheckDialog] = useState(false); const [checking, setChecking] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const all = nodes(incident);
  const scope = all.filter(n => (!region || n.region === region) && (!node || n.id === node));
  const observed = scope.filter(n => n.health !== 'unavailable');
  const issues = scope.filter(n => n.health !== 'healthy');
  const scopeLabel = node || (region ? regionNames[region] : '整个集群');
  const [reports, setReports] = useState<Report[]>(() => [
    { id: 'check_00028', scope: '整个集群', nodes: nodes(false).map(n => n.id), started: now - 26 * 60000, issues: [], checked: 9 },
    { id: 'check_00027', scope: '新加坡', nodes: ['sg01', 'sg02', 'sg03'], started: now - 3 * 3600000, issues: ['sg03 存储延迟升高，后台同步积压。'], checked: 3 },
  ]);
  const read = observed.reduce((s, n) => s + n.read, 0); const write = observed.reduce((s, n) => s + n.write, 0);
  const pending = observed.reduce((s, n) => s + n.pending, 0);
  const filteredNodes = scope.filter(n => (!status || n.health === status) && n.id.includes(query.toLowerCase().trim()));
  const scopedTasks = seedTasks(seedTime, incident).filter(t => scope.some(n => n.id === t.node));
  const activeTasks = scopedTasks.filter(t => t.state !== 'completed').length;
  const tasks = scopedTasks.filter(t => scope.some(n => n.id === t.node) && (!status || t.state === status) && `${t.name} ${t.id} ${t.node}`.toLowerCase().includes(query.toLowerCase().trim()));
  const filteredReports = reports.filter(r => (!region && !node || r.nodes.some(id => scope.some(n => n.id === id))) && (!status || (r.issues.length ? 'warning' : 'healthy') === status) && `${r.id} ${r.scope}`.toLowerCase().includes(query.toLowerCase().trim())).sort((a, b) => b.started - a.started);
  const total = tab === 'monitor' ? filteredNodes.length : tab === 'tasks' ? tasks.length : filteredReports.length;
  const start = page * Number(limit); const end = start + Number(limit);
  function reset() { setPage(0); }
  function changeTab(value: Tab) { setTab(value); setStatus(''); setQuery(''); reset(); }
  function runCheck() {
    const selected = [...scope]; const label = scopeLabel; setChecking(true);
    timer.current = window.setTimeout(() => {
      const started = Date.now(); const found = selected.filter(n => n.health !== 'healthy');
      setReports(items => [{ id: `check_${String(items.length + 29).padStart(5, '0')}`, scope: label, nodes: selected.map(n => n.id), started, checked: selected.filter(n => n.health !== 'unavailable').length, issues: found.map(n => n.health === 'unavailable' ? `${n.id} 未取得最新状态，请检查节点进程与网络。` : `${n.id} 存储延迟升高，仍有 ${n.pending} 条记录待处理。`) }, ...items]);
      setNow(started); setChecking(false); setCheckDialog(false); changeTab('diagnostics');
    }, 900);
  }
  return <div className="monitor-page">
    <div className="monitor-toolbar"><div className="monitor-scope"><Select label="监控区域" value={region} onChange={value => { setRegion(value); setNode(''); reset(); }} options={[{ value: '', label: '全部区域' }, ...Object.entries(regionNames).map(([value, label]) => ({ value, label }))]}/>{region && <Select label="监控节点" value={node} onChange={value => { setNode(value); reset(); }} options={[{ value: '', label: '全部节点' }, ...all.filter(n => n.region === region).map(n => ({ value: n.id, label: n.id }))]}/>}<span className="monitor-scope-caption">{scope.length} 个节点</span></div><div className="monitor-tools"><Select label="监控时间范围" value={windowMinutes} onChange={setWindowMinutes} options={[{ value: '15', label: '最近 15 分钟' }, { value: '60', label: '最近 1 小时' }, { value: '360', label: '最近 6 小时' }]}/><button className="outline-button" onClick={() => setConnection(true)}><Icon name="gateway" size={15}/>采集接入</button><button className="tenant-primary-button" onClick={() => setCheckDialog(true)}><Icon name="shield" size={15}/>运行检查</button></div></div>
    <section className={`monitor-health ${issues.length ? 'has-issues' : ''}`}><span className="monitor-health-icon"><Icon name={issues.length ? 'alert' : 'shield'} size={21}/></span><div><strong>{issues.length ? `${issues.length} 个节点需要关注` : '运行状态正常'}</strong><span>{observed.length} / {scope.length} 个节点已取得观测{issues.length ? ' · 缺失数据不计入统计' : ' · 服务检查通过，后台无积压'}</span></div><div className="monitor-sampled"><i/>{time(now)} 采样<button className="icon-button" onClick={() => setNow(Date.now())} aria-label="刷新监控预览"><Icon name="refresh" size={15}/></button></div></section>
    <div className="monitor-metrics">{[
      { label: '请求吞吐', value: observed.length ? (read + write).toLocaleString() : '—', unit: '次/秒', note: `读 ${read} · 写 ${write}`, icon: 'activity' as IconName },
      { label: '请求延迟 P95', value: observed.length ? Math.max(...observed.map(n => n.latency)).toString() : '—', unit: 'ms', note: '已观测节点中的最大值', icon: 'clock' as IconName },
      { label: '进程内存', value: observed.length ? (observed.reduce((s, n) => s + n.memory, 0) / 1024).toFixed(2) : '—', unit: 'GiB', note: 'DUBI 进程 · 已观测节点合计', icon: 'server' as IconName },
      { label: '后台待处理', value: observed.length ? pending.toString() : '—', unit: '条', note: pending ? '32 条待修复 · 96 条待同步' : observed.length ? '无修复与同步积压' : '等待取得节点观测', icon: 'tool' as IconName },
    ].map(m => <section key={m.label} className="panel monitor-metric"><div><span>{m.label}</span><Icon name={m.icon} size={16}/></div><strong>{m.value}<small>{m.unit}</small></strong><p>{m.note}</p></section>)}</div>
    <div className="monitor-charts">{observed.length ? <><Trend title="读写吞吐" names={['读取', '写入']} values={[read, write]} unit="次/秒" now={now} minutes={Number(windowMinutes)}/><Trend title="请求延迟 P95" names={['读取', '写入']} values={observed.length ? [Math.max(...observed.map(n => n.latency)) * .63, Math.max(...observed.map(n => n.latency))] : [0, 0]} unit="ms" now={now} minutes={Number(windowMinutes)} warning={pending > 0}/></> : ['读写吞吐', '请求延迟 P95'].map(title => <section key={title} className="panel monitor-chart monitor-chart-empty"><h3>{title}</h3><div><Icon name="activity" size={27}/><strong>暂无可用观测</strong><p>未取得节点指标，暂不绘制趋势。</p></div></section>)}</div>
    <section className="panel monitor-list"><div className="monitor-tabs" role="group" aria-label="监控视图">{([{ id: 'monitor', name: '节点监控' }, { id: 'tasks', name: '后台任务' }, { id: 'diagnostics', name: '诊断记录' }] as const).map(t => <button key={t.id} aria-pressed={tab === t.id} onClick={() => changeTab(t.id)}>{t.name}{t.id === 'tasks' && activeTasks > 0 && <span className="monitor-tab-count">{activeTasks}</span>}</button>)}<span>按添加时间倒序</span></div>
      <div className="monitor-list-toolbar"><div className="segmented" role="group" aria-label="监控预览场景"><button aria-pressed={!incident} onClick={() => { setIncident(false); reset(); }}>正常运行</button><button aria-pressed={incident} onClick={() => { setIncident(true); reset(); }}><span className="amber-dot"/>异常示例</button></div><div className="monitor-list-filters"><label className="monitor-search"><Icon name="search" size={16}/><input aria-label="搜索监控列表" value={query} placeholder={tab === 'monitor' ? '搜索节点名称…' : tab === 'tasks' ? '搜索任务或节点…' : '搜索记录或范围…'} onChange={e => { setQuery(e.target.value); reset(); }}/></label><Select label="监控列表状态" value={status} onChange={value => { setStatus(value); reset(); }} options={[{ value: '', label: '全部状态' }, ...(tab === 'tasks' ? [{ value: 'running', label: '执行中' }, { value: 'waiting', label: '等待重试' }, { value: 'completed', label: '已完成' }] : [{ value: 'healthy', label: tab === 'diagnostics' ? '检查通过' : '正常' }, { value: 'warning', label: '需关注' }, ...(tab === 'monitor' ? [{ value: 'unavailable', label: '不可达' }] : [])])]}/></div></div>
      {total > 0 ? <div className="table-scroll"><table className="dense-table monitor-table"><thead><tr>{(tab === 'monitor' ? ['节点 / 区域', '进程 CPU', '进程内存', '读 / 写请求', '延迟 P95', '后台待处理', '状态', '操作'] : tab === 'tasks' ? ['任务 / 标识', '节点 / 区域', '开始时间', '当前进度', '状态', '操作'] : ['检查记录', '检查范围', '执行时间', '观测覆盖', '状态', '操作']).map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>
        {tab === 'monitor' && filteredNodes.slice(start, end).map(n => <tr key={n.id}><td><button className="resource-link" onClick={() => setDetail({ type: 'node', node: n })}><Icon name="server" size={16}/>{n.id}</button><small className="cell-secondary">{regionNames[n.region]}</small></td><td><ResourceUsage node={n} kind="cpu"/></td><td><ResourceUsage node={n} kind="memory"/></td><td>{n.health === 'unavailable' ? '—' : <>{n.read} <span className="monitor-muted">/</span> {n.write}<small className="cell-secondary">次 / 秒</small></>}</td><td className={n.latency > 100 && n.health !== 'unavailable' ? 'monitor-warn' : ''}>{n.health === 'unavailable' ? '—' : `${n.latency} ms`}</td><td>{n.health === 'unavailable' ? '未知' : n.pending ? <span className="monitor-warn">{n.pending} 条</span> : <span className="monitor-muted">无积压</span>}</td><td><HealthBadge state={n.health}/></td><td><button className="text-button" aria-label={`查看监控 ${n.id}`} onClick={() => setDetail({ type: 'node', node: n })}>详情<Icon name="arrow" size={12}/></button></td></tr>)}
        {tab === 'tasks' && tasks.slice(start, end).map(t => <tr key={t.id}><td><button className="resource-link" onClick={() => setDetail({ type: 'task', task: t })}>{t.name}</button><code className="cell-secondary">{t.id}</code></td><td>{t.node}<small className="cell-secondary">{regionNames[t.node.slice(0, 2)]}</small></td><td>{date(t.started)}</td><td>{t.count}</td><td><TaskBadge state={t.state}/></td><td><button className="text-button" aria-label={`查看任务 ${t.id}`} onClick={() => setDetail({ type: 'task', task: t })}>详情<Icon name="arrow" size={12}/></button></td></tr>)}
        {tab === 'diagnostics' && filteredReports.slice(start, end).map(r => <tr key={r.id}><td><button className="resource-link" onClick={() => setDetail({ type: 'report', report: r })}><Icon name="shield" size={16}/>{r.id}</button><small className="cell-secondary">{r.issues.length ? `${r.issues.length} 项需要关注` : '未发现异常'}</small></td><td>{r.scope}<small className="cell-secondary">{r.nodes.length} 个节点</small></td><td>{date(r.started)}</td><td>{r.checked} / {r.nodes.length} 节点</td><td><span className={`status state-${r.issues.length ? 'warning' : 'healthy'}`}><i/>{r.issues.length ? '需关注' : '检查通过'}</span></td><td><button className="text-button" aria-label={`查看诊断 ${r.id}`} onClick={() => setDetail({ type: 'report', report: r })}>详情<Icon name="arrow" size={12}/></button></td></tr>)}
      </tbody></table></div> : <div className="list-empty"><Icon name="search" size={25}/><h3>没有匹配的{tab === 'monitor' ? '节点' : tab === 'tasks' ? '任务' : '诊断记录'}</h3><p>尝试调整区域、节点或状态筛选。</p><button className="outline-button" onClick={() => { setStatus(''); setQuery(''); setRegion(''); setNode(''); reset(); }}>清除筛选</button></div>}
      <div className="pagination"><span>共 {total} 条 · 第 {page + 1} 页</span><Select label="监控每页条数" value={limit} onChange={v => { setLimit(v); reset(); }} options={['5', '10', '20'].map(v => ({ value: v, label: `每页 ${v} 条` }))}/><button className="outline-button" disabled={page === 0} onClick={() => setPage(p => p - 1)}>上一页</button><button className="outline-button" disabled={end >= total} onClick={() => setPage(p => p + 1)}>下一页</button></div>
    </section>
    <p className="monitor-footnote"><Icon name="clock" size={14}/>CPU、内存百分比表示 DUBI 进程占节点总资源的比例；预览节点内存为 1 GiB。不可达节点显示 —。</p>
    {detail && <DetailDrawer detail={detail} now={now} onClose={() => setDetail(null)}/>}
    {connection && <PreviewDialog title="采集接入" description="将节点指标接入现有的监控与告警系统。" onClose={() => setConnection(false)} footer={<><button className="outline-button" onClick={() => setConnection(false)}>关闭</button><button className="tenant-primary-button" onClick={() => { setConnection(false); onNavigate('key'); }}>管理监控凭证<Icon name="arrow" size={13}/></button></>}><div className="monitor-endpoints">{[['/healthz', '进程存活', '检查 HTTP 服务是否可响应。'], ['/readyz', '服务就绪', '检查当前节点是否准备好提供服务。'], ['/metrics', '监控指标', '供 Prometheus 等监控系统采集。']].map(([path, title, note]) => <div key={path}><code>{path}</code><strong>{title}</strong><p>{note}</p></div>)}</div><div className="monitor-advice"><Icon name="key" size={18}/><p>指标采集使用监控凭证，通过 Authorization 请求头传入。凭证在“访问与凭证”中统一管理。</p></div><p className="monitor-footnote">本页展示接入方式，不会连接外部监控系统。</p></PreviewDialog>}
    {checkDialog && <PreviewDialog title="运行检查" description="检查当前范围的健康状态，并生成一条诊断记录。" onClose={() => setCheckDialog(false)} busy={checking} footer={<><small>仅演示检查流程</small><button className="outline-button" disabled={checking} onClick={() => setCheckDialog(false)}>取消</button><button className="tenant-primary-button" disabled={checking} onClick={runCheck}><Icon name={checking ? 'refresh' : 'shield'} size={15}/>{checking ? '正在检查…' : '开始检查'}</button></>}><div className="monitor-check-scope"><Icon name="globe" size={24}/><div><strong>{scopeLabel}</strong><span>{scope.length} 个节点 · {scope.map(n => n.id).join(' / ')}</span></div></div><div className="monitor-check-options">{['节点可达性与服务就绪', 'Volume 健康与写入隔离', '数据修复与跨区域同步', '数据再平衡状态'].map(item => <div key={item}><Icon name="check" size={16}/>{item}</div>)}</div><p className="monitor-footnote">只读检查，不修改配置、不移除节点、不触发数据迁移。</p></PreviewDialog>}
  </div>;
}
