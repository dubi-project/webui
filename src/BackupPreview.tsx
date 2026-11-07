import { toast } from './components/Toast';
import { useState } from 'react';
import type { FormEvent } from 'react';
import Icon from './Icon';
import Select from './components/Select';
import PreviewDialog from './components/PreviewDialog';
import useDrawer from './components/useDrawer';
import './backup-preview.css';

type Repo = { name: string; type: 'file' | 's3'; path: string; bucket: string; prefix: string; endpoint: string; region: string; pathStyle: boolean; hasSecret: boolean; observed: number | null };
type Job = { id: string; repo: string; state: 'pending' | 'running' | 'completed' | 'failed'; started: number; ended?: number; done: number; bytes: string; objects: string; point?: string; error?: string };
const hour = 3600000;
const date = (n: number) => new Date(n).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace('/', '-');
const regions = ['新加坡', '法兰克福', '多伦多'];
const nodeNames = ['sg01','sg02','sg03','ff01','ff02','ff03','tt01','tt02','tt03'];
const initialRepos: Repo[] = [
  { name: 'primary', type: 's3', path: '', bucket: 'dubi-backups', prefix: 'cluster-main/', endpoint: 'https://s3.example.com', region: 'us-east-1', pathStyle: false, hasSecret: true, observed: 9 },
  { name: 'local', type: 'file', path: '/backup/dubi', bucket: '', prefix: '', endpoint: '', region: '', pathStyle: false, hasSecret: false, observed: 9 },
  { name: 'archive', type: 's3', path: '', bucket: 'dubi-archive', prefix: 'cluster-main/', endpoint: 'https://archive.example.com', region: 'eu-central-1', pathStyle: true, hasSecret: true, observed: 6 },
];
function seedJobs(now: number): Job[] {
  return [
    { id: 'backup_002861', repo: 'primary', state: 'running', started: now - 12 * 60000, done: 6, bytes: '842 MiB', objects: '1,248' },
    { id: 'backup_002854', repo: 'primary', state: 'completed', started: now - 6 * hour, ended: now - 6 * hour + 8 * 60000, done: 9, bytes: '1.26 GiB', objects: '1,896', point: 'rp_286104' },
    { id: 'backup_002849', repo: 'local', state: 'completed', started: now - 12 * hour, ended: now - 12 * hour + 5 * 60000, done: 9, bytes: '648 MiB', objects: '964', point: 'rp_285912' },
    { id: 'backup_002831', repo: 'primary', state: 'completed', started: now - 24 * hour, ended: now - 24 * hour + 9 * 60000, done: 9, bytes: '2.08 GiB', objects: '2,712', point: 'rp_285206' },
    { id: 'backup_002810', repo: 'archive', state: 'failed', started: now - 30 * hour, ended: now - 30 * hour + 4 * 60000, done: 6, bytes: '312 MiB', objects: '487', error: '多伦多区域的 3 个节点连接仓库超时，恢复点未完成封存。' },
    { id: 'backup_002792', repo: 'local', state: 'completed', started: now - 48 * hour, ended: now - 48 * hour + 6 * 60000, done: 9, bytes: '976 MiB', objects: '1,420', point: 'rp_284831' },
  ];
}
function RepoStatus({ repo }: { repo: Repo }) {
  const state = repo.observed === null ? 'neutral' : repo.observed === 9 ? 'healthy' : 'warning';
  return <span className={`status state-${state} backup-status`}><i/>{repo.observed === null ? '未检查' : repo.observed === 9 ? '可访问' : '部分不可达'}</span>;
}
function JobStatus({ job }: { job: Job }) {
  const labels = { pending: '等待执行', running: '备份中', completed: '已完成', failed: '失败' };
  return <span className={`status backup-status job-${job.state}`}><i/>{labels[job.state]}</span>;
}
function Location({ repo }: { repo: Repo }) { return <><span className="backup-location">{repo.type === 'file' ? repo.path : repo.bucket}</span><small className="cell-secondary">{repo.type === 'file' ? '各节点本地目录' : repo.prefix || 'Bucket 根目录'}</small></>; }
function Progress({ job }: { job: Job }) { return <div className={`backup-progress ${job.state === 'failed' ? 'failed' : ''}`}><span><strong>{job.done}</strong> / 9 节点</span><div className="meter"><span style={{ width: `${job.done / 9 * 100}%` }}/></div></div>; }
function RepoForm({ initial, repos, onClose, onSave }: { initial?: Repo; repos: Repo[]; onClose: () => void; onSave: (repo: Repo) => void }) {
  const [type, setType] = useState<'file' | 's3'>(initial?.type ?? 'file');
  const [name, setName] = useState(initial?.name ?? ''); const [path, setPath] = useState(initial?.path ?? '/backup/dubi');
  const [bucket, setBucket] = useState(initial?.bucket ?? ''); const [prefix, setPrefix] = useState(initial?.prefix ?? '');
  const [endpoint, setEndpoint] = useState(initial?.endpoint ?? ''); const [region, setRegion] = useState(initial?.region ?? '');
  const [pathStyle, setPathStyle] = useState(initial?.pathStyle ?? false);
  const [access, setAccess] = useState(''); const [secret, setSecret] = useState(''); const [error, setError] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault(); const id = name.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(id)) { setError('仓库名称需以字母或数字开头，仅包含字母、数字、点、下划线或短横线。'); return; }
    if (repos.some(r => r.name === id && r.name !== initial?.name)) { setError('此仓库名称已存在。'); return; }
    if (type === 'file' && (!path.startsWith('/') || path.includes('//') || path.split('/').some(p => p === '.' || p === '..') || (path.length > 1 && path.endsWith('/')))) { setError('请输入规范的绝对目录路径，例如 /backup/dubi。'); return; }
    if (type === 's3') {
      if (!bucket.trim() || /[/\\]/.test(bucket) || prefix.startsWith('/')) { setError('请填写有效 Bucket，Prefix 不能以斜杠开头。'); return; }
      if (endpoint.trim()) { try { const u = new URL(endpoint); if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || u.search || u.hash) throw Error(); } catch { setError('Endpoint 应为有效的 HTTP(S) 地址，不包含账号或查询参数。'); return; } }
      if (!!access !== !!secret || (!initial?.hasSecret && (!access || !secret))) { setError('请同时填写 Access Key 和 Secret Key；预览请使用示例值。'); return; }
    }
    // Credentials are deliberately discarded. This preview never persists secrets.
    onSave({ name: id, type, path: type === 'file' ? path : '', bucket: type === 's3' ? bucket.trim() : '', prefix: type === 's3' ? prefix.trim() : '', endpoint: type === 's3' ? endpoint.trim() : '', region: type === 's3' ? region.trim() : '', pathStyle: type === 's3' && pathStyle, hasSecret: type === 's3', observed: null });
  }
  return <PreviewDialog title={initial ? '仓库设置' : '添加仓库'} description="仓库配置由集群统一管理，各节点共用。" onClose={onClose} footer={<><small>本地预览，不连接存储服务</small><button className="outline-button" onClick={onClose}>取消</button><button className="tenant-primary-button" type="submit" form="repository-form">{initial ? '保存设置' : '添加仓库'}</button></>}>
    <form id="repository-form" onSubmit={submit}><fieldset className="backup-type-options"><legend>存储类型</legend>{(['file','s3'] as const).map(t => <label key={t} className={type === t ? 'selected' : ''}><input type="radio" name="repository-type" checked={type === t} disabled={!!initial} onChange={() => { setType(t); setError(''); }}/><Icon name={t === 'file' ? 'volume' : 'globe'} size={21}/><span><strong>{t === 'file' ? '文件目录' : 'S3 对象存储'}</strong><small>{t === 'file' ? '各节点本地盘或挂载目录' : 'AWS S3 / S3-compatible'}</small></span></label>)}</fieldset>
      <label htmlFor="repository-name">仓库名称</label><input id="repository-name" autoFocus required readOnly={!!initial} maxLength={128} value={name} placeholder="例如 primary" onChange={e => setName(e.target.value)}/>
      {type === 'file' ? <><label htmlFor="repository-path">目录路径</label><input id="repository-path" required value={path} placeholder="/backup/dubi" onChange={e => setPath(e.target.value)}/><div className="backup-explanation"><Icon name="server" size={18}/><p>同一路径按各节点本地目录解释。每个节点将自己的备份数据写入本地备份盘，无需共享目录。</p></div></> : <>
        <label htmlFor="repository-endpoint">Endpoint <small>可选</small></label><input id="repository-endpoint" type="url" value={endpoint} placeholder="https://s3.example.com" onChange={e => setEndpoint(e.target.value)}/><p className="preview-form-help">使用标准 AWS S3 时可留空。</p>
        <div className="preview-form-grid"><div><label htmlFor="repository-bucket">Bucket</label><input id="repository-bucket" required maxLength={255} value={bucket} placeholder="dubi-backups" onChange={e => setBucket(e.target.value)}/></div><div><label htmlFor="repository-prefix">Prefix <small>可选</small></label><input id="repository-prefix" value={prefix} placeholder="cluster-main/" onChange={e => setPrefix(e.target.value)}/></div></div>
        <label htmlFor="repository-region">Region <small>可选</small></label><input id="repository-region" value={region} placeholder="us-east-1" onChange={e => setRegion(e.target.value)}/>
        <div className="preview-form-grid"><div><label htmlFor="repository-access">Access Key</label><input id="repository-access" type="password" autoComplete="off" value={access} placeholder={initial?.hasSecret ? '留空保留已有凭据' : '输入示例 Access Key'} onChange={e => setAccess(e.target.value)}/></div><div><label htmlFor="repository-secret">Secret Key</label><input id="repository-secret" type="password" autoComplete="off" value={secret} placeholder={initial?.hasSecret ? '留空保留已有凭据' : '输入示例 Secret Key'} onChange={e => setSecret(e.target.value)}/></div></div>
        <p className="preview-form-help">此处仅预览表单，请勿输入真实密钥。正式接入后凭据随仓库加密保存。</p>
        <label className="backup-checkbox"><input type="checkbox" checked={pathStyle} onChange={e => setPathStyle(e.target.checked)}/>使用 Path-style 访问</label>
      </>}{error && <p className="preview-form-error" role="alert">{error}</p>}
    </form>
  </PreviewDialog>;
}
function BackupRun({ repos, defaultRepo, onClose, onRun }: { repos: Repo[]; defaultRepo: string; onClose: () => void; onRun: (repo: string) => void }) {
  const [name, setName] = useState(defaultRepo || repos[0]?.name || ''); const repo = repos.find(r => r.name === name);
  return <PreviewDialog title="立即备份" description="创建一次集群级备份，所有节点共同完成。" onClose={onClose} footer={<><small>仅创建预览任务</small><button className="outline-button" onClick={onClose}>取消</button><button className="tenant-primary-button" disabled={!repo} onClick={() => onRun(name)}>开始备份</button></>}>
    <span className="preview-form-label backup-first-label">目标仓库</span><div className="backup-form-select"><Select label="备份目标仓库" value={name} onChange={setName} options={repos.map(r => ({ value: r.name, label: `${r.name}${r.name === defaultRepo ? ' · 默认' : ''} · ${r.type === 'file' ? '文件目录' : 'S3'}` }))}/></div>
    {repo && <div className="backup-target"><Icon name={repo.type === 'file' ? 'volume' : 'globe'} size={20}/><div><Location repo={repo}/></div></div>}
    <dl className="backup-run-fields"><dt>备份范围</dt><dd>整个集群 · 3 个区域 / 9 个节点</dd><dt>存储方式</dt><dd>增量写入，复用未变化的对象</dd><dt>恢复方式</dt><dd>每次完成的备份均为独立恢复点</dd></dl>
    <div className="backup-explanation"><Icon name="archive" size={18}/><p>各节点直接写入目标仓库。仅当数据校验完成、恢复点封存后，才可用于恢复。</p></div>
    {repo?.observed !== 9 && <p className="backup-warning"><Icon name="alert" size={16}/>{repo?.observed === null ? '此仓库尚未检查可访问性。' : '部分节点无法访问仓库，请先核对连接配置。'}</p>}
  </PreviewDialog>;
}
function RestoreInfo({ job, onClose }: { job: Job; onClose: () => void }) {
  return <PreviewDialog title="恢复准备" description="使用已完成的恢复点，在全新空集群中恢复数据。" onClose={onClose} footer={<button className="tenant-primary-button" onClick={onClose}>关闭</button>}>
    <div className="backup-restore-source"><Icon name="archive" size={23}/><div><strong>{job.point}</strong><span>{job.repo} · {date(job.started)}</span></div><JobStatus job={job}/></div>
    <ol className="backup-restore-steps"><li><span>1</span><div><strong>准备空集群与仓库访问</strong><p>目标节点使用全新身份，并能读取所需的备份数据。</p></div></li><li><span>2</span><div><strong>完整校验恢复点</strong><p>检查节点清单、对象完整性及目标映射，校验通过后才开始写入。</p></div></li><li><span>3</span><div><strong>恢复数据并等待平衡</strong><p>恢复底座状态与数据，再由 Repair / Rebalance 补齐和调整分布。</p></div></li></ol>
    <div className="backup-explanation"><Icon name="shield" size={18}/><p>本页仅展示恢复准备信息，不会覆盖当前集群。恢复执行入口待接入。</p></div>
  </PreviewDialog>;
}
function Detail({ repo, job, defaultRepo, onClose, onRestore }: { repo: Repo; job?: Job; defaultRepo: string; onClose: () => void; onRestore: () => void }) {
  const { dialog, closing, requestClose, onAnimationEnd } = useDrawer(onClose);
  return <dialog ref={dialog} className={`inspect-drawer backup-drawer${closing ? ' is-closing' : ''}`} aria-labelledby="backup-detail-title" onAnimationEnd={onAnimationEnd} onCancel={e => { e.preventDefault(); requestClose(); }} onClick={e => { if (e.target === e.currentTarget && e.clientX < e.currentTarget.getBoundingClientRect().left) requestClose(); }}>
    <header className="drawer-header"><div><div className="eyebrow">{job ? '备份详情' : '仓库详情'}</div><h2 id="backup-detail-title">{job?.id ?? repo.name}</h2><p>{job ? '集群级备份任务与节点进度' : repo.type === 'file' ? '文件目录 · 各节点独立保存' : 'S3 · 共享备份目标'}</p></div><button className="icon-button" aria-label="关闭备份详情" autoFocus onClick={requestClose}><Icon name="close"/></button></header>
    <div className="drawer-body"><div className="backup-detail-banner"><span className="backup-resource-icon"><Icon name={job ? 'archive' : repo.type === 'file' ? 'volume' : 'globe'} size={22}/></span><div><strong>{job ? job.state === 'completed' ? '恢复点已封存' : job.state === 'failed' ? '恢复点不可用' : job.state === 'pending' ? '等待备份执行' : '正在创建恢复点' : repo.name === defaultRepo ? '默认备份仓库' : '备份仓库'}</strong><span>{job ? '整个集群 · 9 个节点' : '集群统一配置'}</span></div>{job ? <JobStatus job={job}/> : <RepoStatus repo={repo}/>}</div>
      <h3>基本信息</h3>{job ? <dl className="detail-fields"><dt>目标仓库</dt><dd>{repo.name}</dd><dt>开始时间</dt><dd>{date(job.started)}</dd><dt>结束时间</dt><dd>{job.ended ? date(job.ended) : '—'}</dd><dt>写入数据</dt><dd>{job.bytes}</dd><dt>写入对象</dt><dd>{job.objects}</dd><dt>恢复点</dt><dd>{job.point ?? '尚未封存'}</dd><dt>备份方式</dt><dd>增量存储 · 独立恢复点</dd></dl> : <dl className="detail-fields"><dt>仓库名称</dt><dd>{repo.name}</dd><dt>存储类型</dt><dd>{repo.type === 'file' ? '文件目录' : 'S3'}</dd>{repo.type === 'file' ? <><dt>目录路径</dt><dd><code>{repo.path}</code></dd></> : <><dt>Endpoint</dt><dd className="backup-wrap">{repo.endpoint || 'AWS S3 默认地址'}</dd><dt>Bucket</dt><dd>{repo.bucket}</dd><dt>Prefix</dt><dd>{repo.prefix || '—'}</dd><dt>Region</dt><dd>{repo.region || '—'}</dd><dt>凭据</dt><dd>{repo.hasSecret ? '已配置 · 不展示密钥' : '未配置'}</dd><dt>Path-style</dt><dd>{repo.pathStyle ? '启用' : '关闭'}</dd></>}</dl>}
      {job?.error && <p className="backup-warning"><Icon name="alert" size={17}/>{job.error}</p>}
      <section className="backup-detail-section"><div className="backup-section-heading"><h3>{job ? '节点执行进度' : '节点可访问性'}</h3><span>{job ? `${job.done} / 9 完成` : repo.observed === null ? '尚未检查' : `${repo.observed} / 9 可访问`}</span></div><div className="backup-node-list">{nodeNames.map((node, i) => { const ready = job ? i < job.done : repo.observed !== null && i < repo.observed; const failed = job ? job.state === 'failed' && !ready : repo.observed !== null && !ready; return <div key={node}><Icon name="server" size={16}/><strong>{node}</strong><span>{regions[Math.floor(i / 3)]}</span><span className={`backup-node-state ${ready ? 'ready' : failed ? 'failed' : ''}`}>{ready ? job ? '已完成' : '可访问' : failed ? job ? '失败' : '不可达' : job?.state === 'running' ? '执行中' : job ? '待执行' : '未检查'}</span></div>; })}</div></section>
      {repo.type === 'file' && <div className="backup-explanation"><Icon name="volume" size={17}/><p>{repo.path} 是各节点本地目录。恢复时需要取得对应节点的备份内容。</p></div>}
    </div><footer className="backup-drawer-footer"><button className="outline-button" onClick={requestClose}>关闭</button>{job?.state === 'completed' && <button className="tenant-primary-button" onClick={onRestore}>恢复准备</button>}</footer>
  </dialog>;
}

export default function BackupPreview() {
  const [now] = useState(Date.now); const [repos, setRepos] = useState(initialRepos); const [jobs, setJobs] = useState(() => seedJobs(now));
  const [defaultRepo, setDefaultRepo] = useState('primary');
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState(''); const [repositoryFilter, setRepositoryFilter] = useState('');
  const [limit, setLimit] = useState('20'); const [page, setPage] = useState(0); const [editing, setEditing] = useState<Repo | 'new' | null>(null);
  const [running, setRunning] = useState(false); const [selected, setSelected] = useState<{ repo: string; job?: string } | null>(null); const [restore, setRestore] = useState<Job | null>(null); const setNotice = toast.success;
  const filteredJobs = jobs.filter(j => (!filter || j.state === filter) && (!repositoryFilter || j.repo === repositoryFilter) && `${j.id} ${j.point ?? ''} ${j.repo}`.toLowerCase().includes(query.trim().toLowerCase()));
  const total = filteredJobs.length; const offset = page * Number(limit);
  const detailRepo = repos.find(r => r.name === selected?.repo); const detailJob = jobs.find(j => j.id === selected?.job);
  function reset() { setQuery(''); setFilter(''); setRepositoryFilter(''); setPage(0); }
  function selectRepository(name: string) { setRepositoryFilter(name); setPage(0); }
  function showRestore(job: Job) { setSelected(null); setRestore(job); }
  return <div className="backup-page">
    <section className="section-block backup-repositories" aria-label="备份仓库">
      <div className="section-heading"><h2>备份仓库<span>{repos.length}</span></h2><div className="repository-heading-actions">
        {repositoryFilter && <button className="text-button" onClick={() => selectRepository('')}>全部仓库</button>}
        <button className="outline-button" onClick={() => setEditing('new')}><Icon name="plus" size={14}/>添加仓库</button>
      </div></div>
      <div className="region-grid repository-grid">{repos.map(r => {
        const completed = jobs.filter(j => j.repo === r.name && j.state === 'completed');
        const latest = completed.reduce((n, j) => Math.max(n, j.ended ?? 0), 0);
        const chosen = repositoryFilter === r.name;
        return <article className={`region-card repository-card${chosen ? ' is-selected' : ''}`} key={r.name}>
          <button className="repository-card-select" aria-label={`筛选仓库 ${r.name} 的备份`} aria-pressed={chosen} onClick={() => selectRepository(chosen ? '' : r.name)}>
            <span className="repository-card-top"><span className="backup-resource-icon"><Icon name={r.type === 'file' ? 'volume' : 'globe'} size={19}/></span><span className="repository-card-name"><strong>{r.name}</strong><span>{r.type === 'file' ? '文件目录' : 'S3 对象存储'}{r.name === defaultRepo && <span className="backup-default">默认</span>}</span></span><RepoStatus repo={r}/></span>
            <span className="repository-card-location"><Location repo={r}/></span>
            <span className="repository-card-metrics"><span>可恢复备份<strong>{completed.length}<small> 个</small></strong></span><span>最近成功<strong>{latest ? date(latest) : '—'}</strong></span></span>
            <span className="repository-card-access"><Icon name="server" size={13}/>{r.observed === null ? '节点可访问性尚未检查' : `${r.observed} / 9 节点可访问`}<span>{chosen ? '已筛选' : '查看备份'}<Icon name={chosen ? 'check' : 'arrow'} size={12}/></span></span>
          </button>
          <div className="repository-card-actions">{r.name !== defaultRepo && <button className="text-button" onClick={() => { setDefaultRepo(r.name); setNotice(`已在预览中将 ${r.name} 设为默认仓库。`); }} aria-label={`设为默认仓库 ${r.name}`}>设为默认</button>}<span/>
            <button className="text-button" onClick={() => setEditing(r)} aria-label={`设置仓库 ${r.name}`}>设置</button><button className="text-button" onClick={() => setSelected({ repo: r.name })} aria-label={`查看仓库 ${r.name}`}>详情<Icon name="arrow" size={12}/></button>
          </div>
        </article>;
      })}</div>
    </section>

    <section className="panel"><div className="panel-heading backup-record-heading"><h2>备份记录<span>{total}</span>{repositoryFilter && <small>{repositoryFilter}</small>}</h2><button className="tenant-primary-button" onClick={() => setRunning(true)}><Icon name="plus" size={15}/>立即备份</button></div>
      <div className="list-toolbar"><label className="search-field"><Icon name="search" size={17}/><input aria-label="搜索备份" placeholder="搜索备份标识、恢复点或仓库…" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }}/>{query && <button aria-label="清空备份搜索" onClick={() => { setQuery(''); setPage(0); }}><Icon name="close" size={14}/></button>}</label>
        <Select label="筛选备份状态" value={filter} onChange={value => { setFilter(value); setPage(0); }} options={[{ value:'',label:'全部状态' },{ value:'completed',label:'已完成' },{ value:'running',label:'备份中' },{ value:'pending',label:'等待执行' },{ value:'failed',label:'失败' }]}/>
        <Select label="筛选备份仓库" value={repositoryFilter} onChange={selectRepository} options={[{ value:'',label:'全部仓库' },...repos.map(r => ({ value:r.name,label:r.name }))]}/>
        {(query || filter || repositoryFilter) && <button className="text-button" onClick={reset}>清除筛选</button>}
      </div>
      <div className="table-scroll"><table className="dense-table backup-table"><thead><tr><th>备份 / 恢复点</th><th>目标仓库</th><th>开始时间</th><th>节点进度</th><th>写入数据</th><th>状态</th><th>操作</th></tr></thead><tbody>{filteredJobs.slice(offset,offset+Number(limit)).map(j => <tr key={j.id}><td><div className="backup-row-identity"><span className={`backup-resource-icon ${j.state === 'running' ? 'working' : ''}`}><Icon name="archive" size={17}/></span><div><button className="resource-link" onClick={() => setSelected({ repo:j.repo,job:j.id })}>{j.id}</button><small className="cell-secondary">{j.point ?? (j.state === 'failed' ? '未生成恢复点' : '恢复点尚未生成')}</small></div></div></td><td><button className="text-button" onClick={() => setSelected({ repo:j.repo })}>{j.repo}</button><small className="cell-secondary">{repos.find(r => r.name === j.repo)?.type === 'file' ? '文件目录' : 'S3'}</small></td><td className="backup-date">{date(j.started)}</td><td><Progress job={j}/></td><td>{j.bytes}<small className="cell-secondary">{j.objects} 个对象</small></td><td><JobStatus job={j}/></td><td><div className="backup-row-actions">{j.state === 'completed' && <button className="text-button" onClick={() => showRestore(j)} aria-label={`恢复准备 ${j.id}`}>恢复准备</button>}<button className="text-button" onClick={() => setSelected({ repo:j.repo,job:j.id })} aria-label={`查看备份 ${j.id}`}>详情<Icon name="arrow" size={12}/></button></div></td></tr>)}</tbody></table></div>
      {!total && <div className="list-empty"><Icon name="search" size={25}/><h3>未找到匹配的备份</h3><p>请调整搜索条件或筛选。</p><button className="outline-button" onClick={reset}>清除筛选</button></div>}
      <div className="pagination"><span>共 {total} 条记录 · 第 {page+1} 页</span><Select label="备份每页条数" value={limit} onChange={v => { setLimit(v);setPage(0); }} options={['5','20','50'].map(value=>({value,label:`每页 ${value} 条`}))}/><button className="outline-button" disabled={!page} onClick={()=>setPage(p=>p-1)}>上一页</button><button className="outline-button" disabled={offset+Number(limit)>=total} onClick={()=>setPage(p=>p+1)}>下一页</button></div>
    </section>
    <div className="backup-page-note"><Icon name="archive" size={16}/><p>每次备份都是独立恢复点，未变化的对象自动复用。备份与恢复由集群底座统一处理。</p></div>
    {detailRepo && <Detail repo={detailRepo} job={detailJob} defaultRepo={defaultRepo} onClose={()=>setSelected(null)} onRestore={()=>detailJob && showRestore(detailJob)}/>}
    {editing && <RepoForm initial={editing === 'new' ? undefined : editing} repos={repos} onClose={()=>setEditing(null)} onSave={r=>{setRepos(items=>editing==='new'?[...items,r]:items.map(i=>i.name===r.name?r:i));setEditing(null);reset();setNotice(`已保存预览仓库 ${r.name}，刷新后恢复示例数据。`);}}/>}
    {running && <BackupRun repos={repos} defaultRepo={repositoryFilter || defaultRepo} onClose={()=>setRunning(false)} onRun={repo=>{ const id=`preview_backup_${Date.now().toString(16)}`;setJobs(items=>[{id,repo,state:'pending',started:Date.now(),done:0,bytes:'0 B',objects:'0'},...items]);setRunning(false);setQuery('');setFilter('');selectRepository(repo);setNotice('已创建预览备份任务，未执行真实备份。');}}/>}
    {restore && <RestoreInfo job={restore} onClose={()=>setRestore(null)}/>}
  </div>;
}
