import type { IRequest, IRequestInput, Status } from './oa-types';
import type { ImageRecognizer } from './image-recognition-contract';
export interface SessionState { user: { username: string; displayName: string } | null; pair: { partnerName: string } | null; recognitionAvailable: boolean }
export class ApiError extends Error { constructor(message: string, public status: number, public code?: string) { super(message); } }
export async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api${path}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-UsFirst': '1' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = result && typeof result === 'object' ? result as Record<string, unknown> : {};
    const fallback = response.status === 403 ? '访问请求被拦截，请刷新页面或检查网络' : `服务器返回异常（HTTP ${response.status}），请稍后重试`;
    throw new ApiError(typeof error.error === 'string' ? error.error : fallback, response.status, typeof error.code === 'string' ? error.code : undefined);
  }
  return result as T;
}
export const getSession = () => api<SessionState>('/session');
export const getRequests = () => api<{ requests: IRequest[] }>('/requests');
export const createRequest = (input: IRequestInput, id: string) => api('/requests', { ...input, id });
export const updateRequest = (id: string, status: Status, note = '') => api(`/requests/${id}/status`, { status, note });
export const recognizePhotos: ImageRecognizer = (photos, signal) => api('/recognize', { photos }, signal);
