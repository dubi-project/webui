import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { APIError, request } from './api';
import Console from './Console';
import TenantConsole from './TenantConsole';
import NotificationsProvider from './NotificationsProvider';
import type { GatewayInfo, Identity, ManagementResponse } from './api';

const PreviewConsole = import.meta.env.DEV ? lazy(() => import('./PreviewConsole')) : null;

export default function App() {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === '1' && PreviewConsole ? <Suspense fallback={<p className="empty-copy">正在加载预览…</p>}><PreviewConsole/></Suspense> : <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const sessionGeneration = useRef(0);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [gateway, setGateway] = useState<GatewayInfo | null>(null);
  const [token, setToken] = useState('');
  const [username,setUsername]=useState(''); const [password,setPassword]=useState(''); const [tokenMode,setTokenMode]=useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('正在检查登录状态…');

  const expireSession = useCallback(() => {
    sessionGeneration.current++;
    setIdentity(null); setGateway(null); setBusy(false); setMessage('登录已过期或已撤销，请重新登录。');
  }, []);

  function showError(error: unknown) {
    if (error instanceof APIError && error.status === 401) {
      expireSession();
    } else {
      setMessage(error instanceof Error ? error.message : '请求失败，请稍后重试。');
    }
  }

  async function loadGateway(signal?: AbortSignal, me=identity) {
 if(me?.tenant_id){setGateway(null);return;}
    const generation = sessionGeneration.current;
    const value = await request<ManagementResponse<GatewayInfo>>('/api/v1/admin/gateway', { signal });
    if (generation === sessionGeneration.current) setGateway(value.data);
  }

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 20_000);
    async function restore() {
      try {
        const me = await request<Identity>('/api/v1/me', { signal: controller.signal });
        if ((!me.tenant_id && me.role !== 'admin') || !['admin','readwrite','readonly'].includes(me.role) || !me.csrf_token) throw new Error('需要有效的账号登录会话。');
        setIdentity(me);
        await loadGateway(controller.signal,me);
        setMessage('');
      } catch (error) {
        if (!controller.signal.aborted) {
          if (error instanceof APIError && error.status === 401) setMessage('');
          else showError(error);
        }
        else setMessage('连接超时，请刷新页面重试。');
      } finally {
        window.clearTimeout(timer);
        setBusy(false);
      }
    }
    void restore();
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = token.trim();
    if (busy || (tokenMode ? !value : !username.trim() || !password)) return;
    setToken(''); setPassword('');
    setBusy(true);
    setMessage('正在登录…');
    try {
      const me = await request<Identity>('/api/v1/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tokenMode ? { token: value } : {username:username.trim(),password}),
      });
      if ((!me.tenant_id && me.role !== 'admin') || !['admin','readwrite','readonly'].includes(me.role) || !me.csrf_token) throw new Error('需要有效的账号登录会话。');
      setIdentity(me);
      await loadGateway(undefined,me);
      setMessage('');
    } catch (error) { if(error instanceof APIError && error.status===401) setMessage(tokenMode?'管理员 Token 无效或已过期。':'账号或密码不正确。'); else showError(error); }
    finally { setBusy(false); }
  }

  async function refresh() {
    if (busy) return;
    const generation = sessionGeneration.current;
    setBusy(true);
    try {
      await loadGateway();
      if (generation === sessionGeneration.current) setMessage('');
    } catch (error) {
      if (generation === sessionGeneration.current) showError(error);
    } finally {
      if (generation === sessionGeneration.current) setBusy(false);
    }
  }

  async function logout() {
    if (busy || !identity?.csrf_token) return;
    setBusy(true);
    try {
      await request('/api/v1/auth/logout', { method: 'POST', headers: { 'X-Dubi-CSRF': identity.csrf_token } });
      sessionGeneration.current++;
      setIdentity(null); setGateway(null); setMessage('已退出登录。');
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  }

  if(identity?.tenant_id) return <TenantConsole key={identity.csrf_token} identity={identity} busy={busy} message={message} onExpired={expireSession} onIdentityChange={setIdentity} onPasswordChanged={()=>{sessionGeneration.current++;setIdentity(null);setGateway(null);setBusy(false);setMessage('密码已修改，请重新登录。')}} onLogout={()=>void logout()}/>;
  if (identity) return <NotificationsProvider key={identity.csrf_token} csrf={identity.csrf_token!} onExpired={expireSession}><Console identity={identity} gateway={gateway} busy={busy} message={message}
    onIdentityChange={setIdentity} onPasswordChanged={()=>{sessionGeneration.current++;setIdentity(null);setGateway(null);setBusy(false);setMessage('密码已修改，请使用新密码登录。')}} onRefresh={() => void refresh()} onLogout={() => void logout()} onSessionExpired={expireSession} /></NotificationsProvider>;

  return <main className="login-card">
    <header><h1>DUBI</h1><p>登录控制台</p></header>
    <form onSubmit={login} aria-busy={busy}>
      {tokenMode ? <><label htmlFor="admin-token">管理员 Token</label><input id="admin-token" type="password" autoComplete="off" spellCheck={false} required value={token} onChange={event=>setToken(event.target.value)} disabled={busy}/></> : <><label htmlFor="login-username">账号</label><input id="login-username" autoComplete="username" required maxLength={64} value={username} onChange={e=>setUsername(e.target.value)} disabled={busy}/><label htmlFor="login-password">密码</label><input id="login-password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></>}
      <button type="submit" disabled={busy || (tokenMode ? !token.trim() : !username.trim() || !password)}>{busy ? '连接中…' : '登录'}</button>
    </form>
    <button className="login-mode" type="button" disabled={busy} onClick={()=>{setTokenMode(!tokenMode);setToken('');setPassword('');setMessage('')}}>{tokenMode?'使用账号密码登录':'使用管理员 Token 登录'}</button>
    {tokenMode && <p className="login-help">首次创建账号或重置密码，可使用节点 CLI 签发的管理员 Token 登录，在“访问与凭证”中管理账号。</p>}
    <p className="message" role="status" aria-live="polite">{message}</p>
    <footer>使用同一入口登录，按账号归属进入对应控制台。</footer>
  </main>;
}
