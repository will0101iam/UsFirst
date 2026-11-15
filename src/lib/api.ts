import type { IRequest, IRequestInput, Status } from './oa-types';
import type { ImageRecognizer } from './image-recognition-contract';
export interface SessionState { user: { username: string; displayName: string } | null; pair: { partnerName: string } | null; recognitionAvailable: boolean }
export class ApiError extends Error { constructor(message: string, public status: number, public code?: string) { super(message); } }
export async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const abort = new AbortController();
  let timedOut = false;
  const onAbort = () => abort.abort();
  if (signal?.aborted) abort.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timeoutMs = path === '/recognize' ? 45000 : body === undefined ? 10000 : 20000;
  const timeout = setTimeout(() => { timedOut = true; abort.abort(); }, timeoutMs);
  let rejectCancelled: (error: Error) => void = () => {};
  const cancelled = new Promise<never>((_, reject) => { rejectCancelled = reject; });
  const onCancelled = () => rejectCancelled(timedOut
    ? new ApiError(body === undefined ? '连接超时，请重试。' : '请求超时，请先刷新确认操作结果，再手动重试。', 0, 'connection_timeout')
    : new DOMException('请求已取消', 'AbortError'));
  abort.signal.addEventListener('abort', onCancelled, { once: true });
  if (abort.signal.aborted) onCancelled();
  try {
    const work = async () => {
      const response = await fetch(`/api${path}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-UsFirst': '1' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: abort.signal });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = result && typeof result === 'object' ? result as Record<string, unknown> : {};
        const fallback = response.status === 403 ? '访问请求被拦截，请刷新页面或检查网络' : `服务器返回异常（HTTP ${response.status}），请稍后重试`;
        throw new ApiError(typeof error.error === 'string' ? error.error : fallback, response.status, typeof error.code === 'string' ? error.code : undefined);
      }
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new ApiError('服务器响应异常，请刷新后重试。', response.status, 'invalid_response');
      return result as T;
    };
    return await Promise.race([cancelled, work()]);
  } catch (error) {
    if (error instanceof TypeError) throw new ApiError('网络连接失败，请检查网络后重试。', 0, 'connection_network');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
    abort.signal.removeEventListener('abort', onCancelled);
  }
}
export const getSession = () => api<SessionState>('/session');
export const getRequests = () => api<{ requests: IRequest[] }>('/requests');
export const createRequest = (input: IRequestInput, id: string) => api('/requests', { ...input, id });
export const updateRequest = (id: string, status: Status, note = '') => api(`/requests/${id}/status`, { status, note });
export const recognizePhotos: ImageRecognizer = (photos, signal) => api('/recognize', { photos }, signal);
