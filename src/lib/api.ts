import type { IRequest, IRequestInput, Status } from './oa-types';
import type { ImageRecognizer } from './image-recognition-contract';
export interface SessionState { user: { username: string; displayName: string } | null; pair: { partnerName: string } | null; recognitionAvailable: boolean }
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api${path}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-UsFirst': '1' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(result && typeof result === 'object' && 'error' in result && typeof result.error === 'string' ? result.error : '连接失败，请重试', response.status);
  return result as T;
}
export const getSession = () => api<SessionState>('/session');
export const getRequests = () => api<{ requests: IRequest[] }>('/requests');
export const createRequest = (input: IRequestInput, id: string) => api('/requests', { ...input, id });
export const updateRequest = (id: string, status: Status, note = '') => api(`/requests/${id}/status`, { status, note });
export const recognizePhotos: ImageRecognizer = (photos, signal) => api('/recognize', { photos }, signal);
