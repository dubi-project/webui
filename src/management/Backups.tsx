import { toast } from '../components/Toast';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { adminPath, useResource } from './resource';
import { message, useAdminMutation } from './operations';
import Icon from '../Icon';
import Select from '../components/Select';
import PreviewDialog from '../components/PreviewDialog';
import useDrawer from '../components/useDrawer';
import '../backup-preview.css';

type Repo = { name: string; type: 'file' | 's3'; path: string; bucket: string; prefix: string; endpoint: string; region: string; pathStyle: boolean; hasSecret: boolean; revision: string; isDefault: boolean; completed: number; latest: number; access?: string; secret?: string; sessionToken?: string };
type RepoDTO = { name: string; type: 'file' | 's3'; path: string; bucket: string; prefix: string; endpoint: string; region: string; path_style: boolean; credentials_configured: boolean; revision: string; default: boolean; completed_backups: number; latest_created_unix?: number };
type Worker = {node_id: string; name: string; region: string; state: string; bytes: number; objects: number; error?: string};
type Job = { id: string; repo: string; state: 'pending' | 'running' | 'completed' | 'failed'; started: number; done: number; total: number; bytes: string; objects: string; point?: string; error?: string; workers: Worker[]; epoch: number; cluster: string; repositoryType: string };
type JobDTO = {job_id: string; repository: string; state: Job['state']; created_unix?: number; completed_nodes: number; total_nodes: number; bytes: number; objects: number; error?: string; workers?: Worker[]; epoch: number; cluster_id: string; repository_type: string};
const date = (n: number) => n ? new Date(n).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace('/', '-') : '未记录';
function bytes(n: number) { if (n < 1024) return `${n} B`; if(n < 1024 ** 2) return `${(n/1024).toFixed(1)} KiB`; if(n < 1024 ** 3) return `${(n/1024 ** 2).toFixed(1)} MiB`; return `${(n/1024 ** 3).toFixed(2)} GiB`; }
function repoDTO(r: RepoDTO): Repo {return {...r,pathStyle:r.path_style,hasSecret:r.credentials_configured,isDefault:r.default,completed:r.completed_backups,latest:(r.latest_created_unix??0)*1000};}
function jobDTO(j: JobDTO): Job {return {id:j.job_id,repo:j.repository,state:j.state,started:(j.created_unix??0)*1000,done:j.completed_nodes,total:j.total_nodes,bytes:bytes(j.bytes),objects:j.objects.toLocaleString(),point:j.state==='completed'?`epoch ${j.epoch}`:undefined,error:j.error,workers:j.workers??[],epoch:j.epoch,cluster:j.cluster_id,repositoryType:j.repository_type};}
function RepoStatus({ repo }: { repo: Repo }) {return <span className={`status backup-status ${repo.type === 's3' && !repo.hasSecret ? 'state-warning' : 'state-neutral'}`}><i/>{repo.type === 's3' && !repo.hasSecret ? '待配置凭据' : '已配置'}</span>;}
function JobStatus({ job }: { job: Job }) {
  const labels = { pending: '等待执行', running: '备份中', completed: '已完成', failed: '失败' };
  return <span className={`status backup-status job-${job.state}`}><i/>{labels[job.state]}</span>;
}
function Location({ repo }: { repo: Repo }) { return <><span className="backup-location">{repo.type === 'file' ? repo.path : repo.bucket}</span><small className="cell-secondary">{repo.type === 'file' ? '各节点本地目录' : repo.prefix || 'Bucket 根目录'}</small></>; }
function Progress({ job }: { job: Job }) { return <div className={`backup-progress ${job.state === 'failed' ? 'failed' : ''}`}><span><strong>{job.done}</strong> / {job.total} 节点</span><div className="meter"><span style={{ width: `${job.total ? job.done / job.total * 100 : 0}%` }}/></div></div>; }
function RepoForm({ initial, repos, onClose, onSave }: { initial?: Repo; repos: Repo[]; onClose: () => void; onSave: (repo: Repo, requestId: string) => Promise<void> }) {
  const [type, setType] = useState<'file' | 's3'>(initial?.type ?? 'file');
  const [name, setName] = useState(initial?.name ?? ''); const [path, setPath] = useState(initial?.path ?? '/backup/dubi');
  const [bucket, setBucket] = useState(initial?.bucket ?? ''); const [prefix, setPrefix] = useState(initial?.prefix ?? '');
  const [endpoint, setEndpoint] = useState(initial?.endpoint ?? ''); const [region, setRegion] = useState(initial?.region ?? '');
  const [pathStyle, setPathStyle] = useState(initial?.pathStyle ?? false);
  const [busy, setBusy] = useState(false); const [requestId, setRequestId] = useState(() => crypto.randomUUID()); const [sessionToken, setSessionToken] = useState('');
  const [access, setAccess] = useState(''); const [secret, setSecret] = useState(''); const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault(); if(busy) return; const id = name.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(id)) { setError('仓库名称需以字母或数字开头，仅包含字母、数字、点、下划线或短横线。'); return; }
    if (repos.some(r => r.name === id && r.name !== initial?.name)) { setError('此仓库名称已存在。'); return; }
    if (type === 'file' && (!path.startsWith('/') || path.includes('//') || path.split('/').some(p => p === '.' || p === '..') || (path.length > 1 && path.endsWith('/')))) { setError('请输入规范的绝对目录路径，例如 /backup/dubi。'); return; }
    if (type === 's3') {
      if (!bucket.trim() || /[/\\]/.test(bucket) || prefix.startsWith('/')) { setError('请填写有效 Bucket，Prefix 不能以斜杠开头。'); return; }
      if (endpoint.trim()) { try { const u = new URL(endpoint); if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || u.search || u.hash) throw Error(); } catch { setError('Endpoint 应为有效的 HTTP(S) 地址，不包含账号或查询参数。'); return; } }
      if (!!access !== !!secret || (!initial?.hasSecret && (!access || !secret))) { setError('请同时填写 Access Key 和 Secret Key；请填写有效凭据。'); return; }
    }
    setBusy(true); setError('');
    try { await onSave({ name: id, type, path: type === 'file' ? path : '', bucket: type === 's3' ? bucket.trim() : '', prefix: type === 's3' ? prefix.trim() : '', endpoint: type === 's3' ? endpoint.trim() : '', region: type === 's3' ? region.trim() : '', pathStyle: type === 's3' && pathStyle, hasSecret: type === 's3', revision: initial?.revision ?? '', isDefault: initial?.isDefault ?? false, completed: initial?.completed ?? 0, latest: initial?.latest ?? 0, access: type === 's3' ? access : '', secret: type === 's3' ? secret : '', sessionToken: type === 's3' ? sessionToken : '' }, requestId); }
    catch(e) {setError(`${message(e)} 请求标识：${requestId}`);} finally {setBusy(false);}

  }
  return <PreviewDialog title={initial ? '仓库设置' : '添加仓库'} description="仓库配置由集群统一管理，各节点共用。" onClose={onClose} busy={busy} footer={<><small>配置保存至集群</small><button className="outline-button" disabled={busy} onClick={onClose}>取消</button><button className="tenant-primary-button" type="submit" form="repository-form" disabled={busy}>{initial ? '保存设置' : '添加仓库'}</button></>}>
    {!!initial?.completed && <p className="preview-form-help">已有备份依赖此存储位置。如需更换位置，请添加新仓库；S3 访问凭据仍可更新。</p>}<form id="repository-form" onSubmit={submit} onChange={() => {setError('');setRequestId(crypto.randomUUID());}}><fieldset className="credential-form-fields" disabled={busy}><fieldset className="backup-type-options"><legend>存储类型</legend>{(['file','s3'] as const).map(t => <label key={t} className={type === t ? 'selected' : ''}><input type="radio" name="repository-type" checked={type === t} disabled={!!initial} onChange={() => { setType(t); setError(''); }}/><Icon name={t === 'file' ? 'volume' : 'globe'} size={21}/><span><strong>{t === 'file' ? '文件目录' : 'S3 对象存储'}</strong><small>{t === 'file' ? '各节点本地盘或挂载目录' : 'AWS S3 / S3-compatible'}</small></span></label>)}</fieldset>
      <label htmlFor="repository-name">仓库名称</label><input id="repository-name" autoFocus required readOnly={!!initial} maxLength={128} value={name} placeholder="例如 primary" onChange={e => setName(e.target.value)}/>
      {type === 'file' ? <><label htmlFor="repository-path">目录路径</label><input id="repository-path" required value={path} placeholder="/backup/dubi" onChange={e => setPath(e.target.value)}/><div className="backup-explanation"><Icon name="server" size={18}/><p>同一路径按各节点本地目录解释。每个节点将自己的备份数据写入本地备份盘，无需共享目录。</p></div></> : <>
        <label htmlFor="repository-endpoint">Endpoint <small>可选</small></label><input id="repository-endpoint" type="url" value={endpoint} placeholder="https://s3.example.com" onChange={e => setEndpoint(e.target.value)}/><p className="preview-form-help">使用标准 AWS S3 时可留空。</p>
        <div className="preview-form-grid"><div><label htmlFor="repository-bucket">Bucket</label><input id="repository-bucket" required maxLength={255} value={bucket} placeholder="dubi-backups" onChange={e => setBucket(e.target.value)}/></div><div><label htmlFor="repository-prefix">Prefix <small>可选</small></label><input id="repository-prefix" value={prefix} placeholder="cluster-main/" onChange={e => setPrefix(e.target.value)}/></div></div>
        <label htmlFor="repository-region">Region <small>可选</small></label><input id="repository-region" value={region} placeholder="us-east-1" onChange={e => setRegion(e.target.value)}/>
        <div className="preview-form-grid"><div><label htmlFor="repository-access">Access Key</label><input id="repository-access" type="password" autoComplete="off" value={access} placeholder={initial?.hasSecret ? '留空保留已有凭据' : '输入 Access Key'} onChange={e => setAccess(e.target.value)}/></div><div><label htmlFor="repository-secret">Secret Key</label><input id="repository-secret" type="password" autoComplete="off" value={secret} placeholder={initial?.hasSecret ? '留空保留已有凭据' : '输入 Secret Key'} onChange={e => setSecret(e.target.value)}/></div></div>
        <p className="preview-form-help">凭据随仓库加密保存，保存后不再显示。留空保留已有凭据。</p>
        <label htmlFor="repository-session">Session Token <small>可选</small></label><input id="repository-session" type="password" autoComplete="off" value={sessionToken} onChange={e=>setSessionToken(e.target.value)}/><label className="backup-checkbox"><input type="checkbox" checked={pathStyle} onChange={e => setPathStyle(e.target.checked)}/>使用 Path-style 访问</label>
      </>}</fieldset>{error && <p className="preview-form-error" role="alert">{error}</p>}
    </form>
  </PreviewDialog>;
}
function BackupRun({ repos, defaultRepo, onClose, onRun }: { repos: Repo[]; defaultRepo: string; onClose: () => void; onRun: (repo: string, requestId: string) => Promise<void> }) {
  const [name, setName] = useState(defaultRepo || repos[0]?.name || ''); const repo = repos.find(r => r.name === name);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [requestId]=useState(() => crypto.randomUUID());
  async function run() {if(busy)return;setBusy(true);setError('');try{await onRun(name,requestId);}catch(e){setError(`${message(e)} 请求标识：${requestId}`);}finally{setBusy(false);}}
  return <PreviewDialog title="立即备份" description="创建一次集群级备份，所有节点共同完成。" onClose={onClose} busy={busy} footer={<><small>任务由集群后台执行</small><button className="outline-button" disabled={busy} onClick={onClose}>取消</button><button className="tenant-primary-button" disabled={!repo || busy} onClick={() => void run()}>开始备份</button></>}>
    <span className="preview-form-label backup-first-label">目标仓库</span><div className="backup-form-select"><Select label="备份目标仓库" value={name} disabled={busy} onChange={setName} options={repos.map(r => ({ value: r.name, label: `${r.name}${r.name === defaultRepo ? ' · 默认' : ''} · ${r.type === 'file' ? '文件目录' : 'S3'}` }))}/></div>
    {repo && <div className="backup-target"><Icon name={repo.type === 'file' ? 'volume' : 'globe'} size={20}/><div><Location repo={repo}/></div></div>}
    <dl className="backup-run-fields"><dt>备份范围</dt><dd>整个集群 · 按创建时的节点成员执行</dd><dt>存储方式</dt><dd>增量写入，复用未变化的对象</dd><dt>恢复方式</dt><dd>每次完成的备份均为独立恢复点</dd></dl>
    <div className="backup-explanation"><Icon name="archive" size={18}/><p>各节点直接写入目标仓库。仅当数据校验完成、恢复点封存后，才可用于恢复。</p></div>
    {error && <p className="preview-form-error" role="alert">{error}</p>}
  </PreviewDialog>;
}
function RestoreInfo({ job, onClose }: { job: Job; onClose: () => void }) {
 const r=useResource<{backup:JobDTO;repository:RepoDTO;target:string;steps:string[]}>(adminPath(`backups/${encodeURIComponent(job.id)}/restore-preparation`),0);
 return <PreviewDialog title="恢复准备" description="在全新空集群中恢复，不覆盖当前集群。" onClose={onClose} footer={<button className="tenant-primary-button" onClick={onClose}>关闭</button>}>
 {r.loading && <p>正在核对恢复点…</p>}{r.error && <p role="alert" className="preview-form-error">{r.error.message}<button className="text-button" onClick={r.reload}>重试</button></p>}
 {r.response && !r.error && <><div className="backup-restore-source"><Icon name="archive" size={23}/><div><strong>{job.point}</strong><span>{job.repo} · {date(job.started)}</span></div><JobStatus job={job}/></div><dl className="backup-run-fields"><dt>原集群</dt><dd className="backup-wrap">{r.response.data.backup.cluster_id}</dd><dt>仓库位置</dt><dd>{r.response.data.repository.type==='file'?r.response.data.repository.path:r.response.data.repository.bucket}</dd><dt>源节点数</dt><dd>{r.response.data.backup.total_nodes}</dd></dl><ol className="backup-restore-steps">{r.response.data.steps.map((step,i)=><li key={step}><span>{i+1}</span><div><p>{step}</p></div></li>)}</ol><p className="detail-help">这里只核对已封存记录并提供恢复参数。对象完整性需由新集群的恢复工具实际校验；本入口不执行覆盖恢复。</p></>}
 </PreviewDialog>;
}
function Detail({ repo, job, defaultRepo, onClose, onRestore }: { repo: Repo; job?: Job; defaultRepo: string; onClose: () => void; onRestore: () => void }) {
  const { dialog, closing, requestClose, onAnimationEnd } = useDrawer(onClose);
  return <dialog ref={dialog} className={`inspect-drawer backup-drawer${closing ? ' is-closing' : ''}`} aria-labelledby="backup-detail-title" onAnimationEnd={onAnimationEnd} onCancel={e => { e.preventDefault(); requestClose(); }} onClick={e => { if (e.target === e.currentTarget && e.clientX < e.currentTarget.getBoundingClientRect().left) requestClose(); }}>
    <header className="drawer-header"><div><div className="eyebrow">{job ? '备份详情' : '仓库详情'}</div><h2 id="backup-detail-title">{job?.id ?? repo.name}</h2><p>{job ? '集群级备份任务与节点进度' : repo.type === 'file' ? '文件目录 · 各节点独立保存' : 'S3 · 共享备份目标'}</p></div><button className="icon-button" aria-label="关闭备份详情" autoFocus onClick={requestClose}><Icon name="close"/></button></header>
    <div className="drawer-body"><div className="backup-detail-banner"><span className="backup-resource-icon"><Icon name={job ? 'archive' : repo.type === 'file' ? 'volume' : 'globe'} size={22}/></span><div><strong>{job ? job.state === 'completed' ? '恢复点已封存' : job.state === 'failed' ? '恢复点不可用' : job.state === 'pending' ? '等待备份执行' : '正在创建恢复点' : repo.name === defaultRepo ? '默认备份仓库' : '备份仓库'}</strong><span>{job ? `整个集群 · ${job.total} 个节点` : '集群统一配置'}</span></div>{job ? <JobStatus job={job}/> : <RepoStatus repo={repo}/>}</div>
      <h3>基本信息</h3>{job ? <dl className="detail-fields"><dt>目标仓库</dt><dd>{repo.name}</dd><dt>开始时间</dt><dd>{date(job.started)}</dd><dt>备份数据</dt><dd>{job.bytes}</dd><dt>备份对象</dt><dd>{job.objects}</dd><dt>恢复点</dt><dd>{job.point ?? '尚未封存'}</dd><dt>备份方式</dt><dd>增量存储 · 独立恢复点</dd></dl> : <dl className="detail-fields"><dt>仓库名称</dt><dd>{repo.name}</dd><dt>存储类型</dt><dd>{repo.type === 'file' ? '文件目录' : 'S3'}</dd>{repo.type === 'file' ? <><dt>目录路径</dt><dd><code>{repo.path}</code></dd></> : <><dt>Endpoint</dt><dd className="backup-wrap">{repo.endpoint || 'AWS S3 默认地址'}</dd><dt>Bucket</dt><dd>{repo.bucket}</dd><dt>Prefix</dt><dd>{repo.prefix || '—'}</dd><dt>Region</dt><dd>{repo.region || '—'}</dd><dt>凭据</dt><dd>{repo.hasSecret ? '已配置 · 不展示密钥' : '未配置'}</dd><dt>Path-style</dt><dd>{repo.pathStyle ? '启用' : '关闭'}</dd></>}</dl>}
      {job?.error && <p className="backup-warning"><Icon name="alert" size={17}/>{job.error}</p>}
      {job && <section className="backup-detail-section"><div className="backup-section-heading"><h3>节点执行进度</h3><span>{job.done} / {job.total} 完成</span></div><div className="backup-node-list">{job.workers.map(w=><div key={w.node_id}><Icon name="server" size={16}/><strong title={w.node_id}>{w.name || w.node_id}</strong><span>{w.region || '未记录区域'}</span><span className={`backup-node-state ${w.state==='completed'?'ready':w.state==='failed'?'failed':''}`} title={w.error}>{({completed:'已完成',running:'执行中',pending:'待执行',failed:'失败'} as Record<string,string>)[w.state]??w.state}</span></div>)}</div></section>}
      {repo.type === 'file' && <div className="backup-explanation"><Icon name="volume" size={17}/><p>{repo.path} 是各节点本地目录。恢复时需要取得对应节点的备份内容。</p></div>}
    </div><footer className="backup-drawer-footer"><button className="outline-button" onClick={requestClose}>关闭</button>{job?.state === 'completed' && <button className="tenant-primary-button" onClick={onRestore}>恢复准备</button>}</footer>
  </dialog>;
}

export default function Backups({csrf,revision}:{csrf:string;revision:number}) {
  const [query,setQuery]=useState('');const [search,setSearch]=useState('');const [filter,setFilter]=useState('');const [repositoryFilter,setRepositoryFilter]=useState('');
  const [limit,setLimit]=useState('20');const [cursors,setCursors]=useState(['']);const [refresh,setRefresh]=useState(0);
  const [editing,setEditing]=useState<Repo|'new'|null>(null);const [running,setRunning]=useState(false);const [selected,setSelected]=useState<{repo:string;job?:string}|null>(null);const [restore,setRestore]=useState<Job|null>(null);const setNotice = toast.success;const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const mutate=useAdminMutation(csrf);
  const repositories=useResource<RepoDTO[]>(adminPath('repositories'),revision+refresh);
  const records=useResource<{items:JobDTO[];total:number;next_cursor:string}>(adminPath('backups',{q:search,status:filter,repository:repositoryFilter,limit,cursor:cursors.at(-1)!}),revision+refresh);
  const details=useResource<JobDTO>(selected?.job?adminPath(`backups/${encodeURIComponent(selected.job)}`):null,revision+refresh);
  const repos=repositories.response?.data.map(repoDTO)??[];const defaultRepo=repos.find(r=>r.isDefault)?.name??'';const jobs=records.response?.data.items.map(jobDTO)??[];const total=records.response?.data.total??0;
  const detailJob=details.response?jobDTO(details.response.data):undefined;const detailRepo=repos.find(r=>r.name===selected?.repo);
  useEffect(()=>{const t=setTimeout(()=>{setSearch(query.trim());setCursors(['']);},250);return()=>clearTimeout(t);},[query]);
  function setPage(_page:number){setCursors(['']);}
  function reset(){setQuery('');setSearch('');setFilter('');setRepositoryFilter('');setCursors(['']);}
  function selectRepository(name:string){setRepositoryFilter(name);setCursors(['']);}
  function showRestore(job:Job){setSelected(null);setRestore(job);}
  async function makeDefault(name:string){if(busy)return;setBusy(true);setError('');try{await mutate(`repositories/${encodeURIComponent(name)}/default`,'POST',{request_id:crypto.randomUUID()});setRefresh(n=>n+1);setNotice(`已将 ${name} 设为默认仓库。`);}catch(e){setError(message(e));}finally{setBusy(false);}}
  async function saveRepository(r:Repo,requestId:string){await mutate(editing==='new'?'repositories':`repositories/${encodeURIComponent(r.name)}`,editing==='new'?'POST':'PUT',{request_id:requestId,name:r.name,type:r.type,path:r.path,bucket:r.bucket,prefix:r.prefix,endpoint:r.endpoint,region:r.region,path_style:r.pathStyle,revision:r.revision,access_key:r.access,secret_key:r.secret,session_token:r.sessionToken});setEditing(null);setRefresh(n=>n+1);setNotice(`已保存仓库 ${r.name}。`);}
  async function runBackup(repo:string,requestId:string){await mutate('backups','POST',{request_id:requestId,repository:repo});setRunning(false);reset();selectRepository(repo);setRefresh(n=>n+1);setNotice('备份任务已创建，可刷新查看节点执行进度。');}
  return <div className="backup-page">
    <section className="section-block backup-repositories" aria-label="备份仓库">
      <div className="section-heading"><h2>备份仓库<span>{repos.length}</span></h2><div className="repository-heading-actions">
        {repositoryFilter && <button className="text-button" onClick={() => selectRepository('')}>全部仓库</button>}
        <button className="outline-button" disabled={repositories.loading || !!repositories.error} onClick={() => setEditing('new')}><Icon name="plus" size={14}/>添加仓库</button>
      </div></div>
      <div className="region-grid repository-grid">{repos.map(r => {
        const latest = r.latest;
        const chosen = repositoryFilter === r.name;
        return <article className={`region-card repository-card${chosen ? ' is-selected' : ''}`} key={r.name}>
          <button className="repository-card-select" aria-label={`筛选仓库 ${r.name} 的备份`} aria-pressed={chosen} onClick={() => selectRepository(chosen ? '' : r.name)}>
            <span className="repository-card-top"><span className="backup-resource-icon"><Icon name={r.type === 'file' ? 'volume' : 'globe'} size={19}/></span><span className="repository-card-name"><strong>{r.name}</strong><span>{r.type === 'file' ? '文件目录' : 'S3 对象存储'}{r.name === defaultRepo && <span className="backup-default">默认</span>}</span></span><RepoStatus repo={r}/></span>
            <span className="repository-card-location"><Location repo={r}/></span>
            <span className="repository-card-metrics"><span>可恢复备份<strong>{r.completed}<small> 个</small></strong></span><span>最近备份开始<strong>{latest ? date(latest) : '—'}</strong></span></span>
            <span className="repository-card-access"><Icon name="server" size={13}/>{r.type === 'file' ? '各节点独立写入' : '节点直接写入 S3'}<span>{chosen ? '已筛选' : '查看备份'}<Icon name={chosen ? 'check' : 'arrow'} size={12}/></span></span>
          </button>
          <div className="repository-card-actions">{r.name !== defaultRepo && <button className="text-button" disabled={busy || !!repositories.error} onClick={() => void makeDefault(r.name)} aria-label={`设为默认仓库 ${r.name}`}>设为默认</button>}<span/>
            <button className="text-button" disabled={!!repositories.error} onClick={() => setEditing(r)} aria-label={`设置仓库 ${r.name}`}>设置</button><button className="text-button" onClick={() => setSelected({ repo: r.name })} aria-label={`查看仓库 ${r.name}`}>详情<Icon name="arrow" size={12}/></button>
          </div>
        </article>;
      })}</div>
    </section>
    {(error || repositories.error || records.error || details.error) && <p role="alert" className="preview-form-error">{error || message(repositories.error || records.error || details.error)}<button className="text-button" onClick={()=>{setError('');repositories.reload();records.reload();details.reload();}}>重试</button></p>}
    {((repositories.loading && !repositories.response) || (records.loading && !records.response)) && <p className="detail-help">正在读取仓库与备份…</p>}
    {repositories.response && !repositories.error && repos.length===0 && <div className="list-empty">尚未配置备份仓库，请先添加文件目录或 S3 仓库。</div>}

    <section className="panel"><div className="panel-heading backup-record-heading"><h2>备份记录<span>{total}</span>{repositoryFilter && <small>{repositoryFilter}</small>}</h2><button className="tenant-primary-button" disabled={!repos.length || !!repositories.error} onClick={() => setRunning(true)}><Icon name="plus" size={15}/>立即备份</button></div>
      <div className="list-toolbar"><label className="search-field"><Icon name="search" size={17}/><input aria-label="搜索备份" placeholder="搜索备份标识、恢复点或仓库…" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }}/>{query && <button aria-label="清空备份搜索" onClick={() => { setQuery(''); setPage(0); }}><Icon name="close" size={14}/></button>}</label>
        <Select label="筛选备份状态" value={filter} onChange={value => { setFilter(value); setPage(0); }} options={[{ value:'',label:'全部状态' },{ value:'completed',label:'已完成' },{ value:'running',label:'备份中' },{ value:'pending',label:'等待执行' },{ value:'failed',label:'失败' }]}/>
        <Select label="筛选备份仓库" value={repositoryFilter} onChange={selectRepository} options={[{ value:'',label:'全部仓库' },...repos.map(r => ({ value:r.name,label:r.name }))]}/>
        {(query || filter || repositoryFilter) && <button className="text-button" onClick={reset}>清除筛选</button>}
      </div>
      <div className="table-scroll"><table className="dense-table backup-table"><thead><tr><th>备份 / 恢复点</th><th>目标仓库</th><th>开始时间</th><th>节点进度</th><th>备份数据</th><th>状态</th><th>操作</th></tr></thead><tbody>{jobs.map(j => <tr key={j.id}><td><div className="backup-row-identity"><span className={`backup-resource-icon ${j.state === 'running' ? 'working' : ''}`}><Icon name="archive" size={17}/></span><div><button className="resource-link" onClick={() => setSelected({ repo:j.repo,job:j.id })}>{j.id}</button><small className="cell-secondary">{j.point ?? (j.state === 'failed' ? '未生成恢复点' : '恢复点尚未生成')}</small></div></div></td><td><button className="text-button" onClick={() => setSelected({ repo:j.repo })}>{j.repo}</button><small className="cell-secondary">{j.repositoryType === 'file' ? '文件目录' : j.repositoryType === 's3' ? 'S3' : '仓库配置缺失'}</small></td><td className="backup-date">{date(j.started)}</td><td><Progress job={j}/></td><td>{j.bytes}<small className="cell-secondary">{j.objects} 个对象</small></td><td><JobStatus job={j}/></td><td><div className="backup-row-actions">{j.state === 'completed' && <button className="text-button" onClick={() => showRestore(j)} aria-label={`恢复准备 ${j.id}`}>恢复准备</button>}<button className="text-button" onClick={() => setSelected({ repo:j.repo,job:j.id })} aria-label={`查看备份 ${j.id}`}>详情<Icon name="arrow" size={12}/></button></div></td></tr>)}</tbody></table></div>
      {records.response && !records.error && !total && <div className="list-empty"><Icon name="search" size={25}/><h3>未找到匹配的备份</h3><p>请调整搜索条件或筛选。</p><button className="outline-button" onClick={reset}>清除筛选</button></div>}
      <div className="pagination"><span>共 {total} 条记录 · 第 {cursors.length} 页</span><Select label="备份每页条数" value={limit} onChange={v => { setLimit(v);setPage(0); }} options={['5','20','50'].map(value=>({value,label:`每页 ${value} 条`}))}/><button className="outline-button" disabled={records.loading || cursors.length===1} onClick={()=>setCursors(c=>c.slice(0,-1))}>上一页</button><button className="outline-button" disabled={records.loading || !records.response?.data.next_cursor} onClick={()=>setCursors(c=>[...c,records.response!.data.next_cursor])}>下一页</button></div>
    </section>
    <div className="backup-page-note"><Icon name="archive" size={16}/><p>每次完成的备份都是独立恢复点，未变化的对象自动复用。备份与恢复由集群底座统一处理。</p></div>
    {detailRepo && (!selected?.job || detailJob) && !details.error && <Detail repo={detailRepo} job={detailJob} defaultRepo={defaultRepo} onClose={()=>setSelected(null)} onRestore={()=>detailJob && showRestore(detailJob)}/>}
    {editing && <RepoForm initial={editing === 'new' ? undefined : editing} repos={repos} onClose={()=>setEditing(null)} onSave={saveRepository}/>}
    {running && <BackupRun repos={repos} defaultRepo={repositoryFilter || defaultRepo} onClose={()=>setRunning(false)} onRun={runBackup}/>}
    {restore && <RestoreInfo job={restore} onClose={()=>setRestore(null)}/>}
  </div>;
}
