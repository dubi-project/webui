import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { APIError, request } from './api';
import type { ManagementResponse } from './api';
import { NotificationContext } from './Notifications';
import type { Notice } from './Notifications';
import type { IconName } from './Icon';

type DTO = Omit<Notice, 'at' | 'action'> & { created_unix: number };
type Page = { items: DTO[]; unread: number; retained: number; through_index: number; next_cursor: string };
type Mutation = { request_id: string; id?: string; all?: boolean; read: boolean; through_index?: number };
const actions: Record<string,string> = { globe:'查看区域与节点',volume:'查看存储与容量',tenant:'查看租户与配额',key:'查看访问与凭证',archive:'查看仓库与备份',tool:'查看监控与诊断' };
function notice(n: DTO): Notice { return {...n,at:n.created_unix*1000,target:(n.target in actions?n.target:'tool') as IconName,action:actions[n.target]||'查看监控与诊断'}; }
export default function NotificationsProvider({ children, csrf, onExpired }: { children: ReactNode; csrf: string; onExpired: () => void }) {
 const [items,setItems]=useState<Notice[]>([]);const [unread,setUnread]=useState(0);const [total,setTotal]=useState(0);const [ready,setReady]=useState(false);const [summaryReady,setSummaryReady]=useState(false);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [active,setActive]=useState(false);const [revision,setRevision]=useState(0);const [selected,setSelected]=useState<string|null>(null);
 const cut=useRef(0);const generation=useRef(0);const pending=useRef<Mutation|null>(null);const locked=useRef(false);
 const refresh=useCallback(()=>setRevision(v=>v+1),[]);
 useEffect(()=>{const timer=window.setInterval(()=>{if(!document.hidden&&!locked.current)refresh()},15000);return()=>window.clearInterval(timer)},[refresh]);
 useEffect(()=>{
  const sequence=++generation.current;const controller=new AbortController();
  async function load(){try{
   let cursor='';let firstCut:number|undefined;let data:Page|undefined;let collected:DTO[]=[];let pages=0;
   do {const q=new URLSearchParams({limit:active?'200':'5'});if(cursor)q.set('cursor',cursor);const r=await request<ManagementResponse<Page>>(`/api/v1/admin/notifications?${q}`,{signal:controller.signal});data=r.data;firstCut??=data.through_index;collected.push(...data.items);cursor=data.next_cursor;pages++;}while(active&&cursor&&pages<3);
   if(sequence!==generation.current||controller.signal.aborted||!data)return;
   const loaded=[...new Map(collected.map(n=>[n.id,notice(n)])).values()];
   setItems(old=>active?loaded:[...loaded,...old.filter(n=>!loaded.some(x=>x.id===n.id))].slice(0,500));setSummaryReady(true);setUnread(data.unread);setTotal(data.retained);cut.current=firstCut??0;if(active)setReady(true);if(!pending.current)setError('');
  }catch(e){if(controller.signal.aborted||sequence!==generation.current)return;if(e instanceof APIError&&e.status===401){onExpired();return};setError(e instanceof Error?e.message:'消息读取失败。')}}
  void load();return()=>controller.abort();
 },[active,revision,onExpired]);
 async function send(m:Mutation){if(locked.current)return;locked.current=true;generation.current++;setBusy(true);setError('');pending.current=m;
  try{await request('/api/v1/admin/notifications/read',{method:'POST',headers:{'Content-Type':'application/json','X-Dubi-CSRF':csrf},body:JSON.stringify(m)});pending.current=null;
   refresh();
  }catch(e){if(e instanceof APIError&&e.status===401){onExpired();return};if(e instanceof APIError&&[400,403,404,409].includes(e.status))pending.current=null;setError(e instanceof Error?e.message:'更新消息状态失败。');
  }finally{locked.current=false;setBusy(false)}
 }
 function mark(id:string,read:boolean){if(pending.current){setError('上一次操作尚未确认，请先重试。');return;}void send({request_id:crypto.randomUUID(),id,read})}
 function markAll(){if(pending.current){setError('上一次操作尚未确认，请先重试。');return;}void send({request_id:crypto.randomUUID(),all:true,read:true,through_index:cut.current})}
 function open(id:string){setSelected(id);if(items.some(n=>n.id===id&&!n.read))mark(id,true)}
 function retry(){if(pending.current)void send(pending.current);else refresh()}
 return <NotificationContext.Provider value={{items,unread,total,ready,summaryReady,error,busy,retry,refresh,setActive,mark,markAll,open,selected,close:()=>setSelected(null)}}>{children}</NotificationContext.Provider>;
}
