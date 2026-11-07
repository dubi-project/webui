import type { ManagementMeta } from './management/types';
export class APIError extends Error {
  constructor(message: string, public readonly status: number, public readonly requestId = '', public readonly code = '') {
    super(message);
    this.name = 'APIError';
  }
}

export interface Identity {
  tenant_id?: string;
  account_id?: string;
  username?: string;
  name?: string;
  role: string;
  expires_unix: number;
  csrf_token?: string;
}
export interface GatewayInfo {
  node_id: string;
  cluster_id: string;
  api_version: string;
  business_modules: string[];
  certificate?: unknown;
}
export interface ManagementResponse<T> {
  data: T;
  meta: ManagementMeta;
}

// Session credentials stay in the server's Secure/HttpOnly cookie. Never persist
// the operator token or the CSRF token in localStorage, URLs, or application logs.
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    cache: 'no-store',
    signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof body?.message === 'string' ? body.message : `请求失败（${response.status}）`;
    throw new APIError(message, response.status, response.headers.get('X-Request-ID') ?? '', typeof body?.code === 'string' ? body.code : '');
  }
  if (body === null) throw new Error('服务返回了无法识别的响应。');
  return body as T;
}
