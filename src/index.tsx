import { StrictMode } from 'react';
import MountedSignal from '@/components/MountedSignal';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '@/components/ErrorFallback';
import App from './app';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <App />
      <MountedSignal/>
    </ErrorBoundary>
  </StrictMode>,
);
