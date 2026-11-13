import type { IRequest, IRequestInput, Person } from './oa-types';
import { recognitionConfig } from './recognition-config';
import type { ImageRecognitionResult } from './image-recognition-contract';

// Reserved contract only: no calls occur until a same-origin authenticated backend is implemented.
// Never put LLM API keys, passwords or private tokens in VITE_* variables or browser code.
// Backend must own authentication and state transitions, validate integer CNY cents,
// prevent self-approval, restrict two users, and keep images private.
const base = (import.meta.env.MIAODA_CLIENT_BASE_PATH || '').replace(/\/$/, '') + '/';
const contracts = {
  login: `${base}api/session`,
  requests: `${base}api/requests`,
  photos: `${base}api/photos`,
  recognize: `${base}api/recognize`,
};
export interface IOaBackend {
  login(username: string, password: string): Promise<{ person: Person }>;
  logout(): Promise<void>;
  listRequests(): Promise<IRequest[]>;
  createRequest(input: IRequestInput): Promise<IRequest>;
  decideRequest(id: string, status: 'approved' | 'rejected', note: string): Promise<IRequest>;
  cancelRequest(id: string): Promise<IRequest>;
  markPurchased(id: string): Promise<IRequest>;
  uploadPhoto(file: File): Promise<{ privatePhotoId: string }>;
  recognizePhotos(privatePhotoIds: readonly string[], signal: AbortSignal): Promise<ImageRecognitionResult>;
}
export const backendContract = {
  endpoints: contracts,
  authentication: 'server-owned fixed two accounts; HttpOnly Secure SameSite session cookie',
  requests: 'GET list, POST create; /:id/decision, /:id/cancel, /:id/purchased',
  model: recognitionConfig.model,
  recognition: 'POST authenticated private photoIds; return editable title/amountCents/currency/category/amountSource/amountEvidence/warnings only; never infer a reason, submit or approve automatically',
  note: 'Not connected. UI currently uses an explicitly labelled local demo store.',
} as const;
