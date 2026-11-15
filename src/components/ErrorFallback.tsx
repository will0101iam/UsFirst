import { useEffect } from 'react';
import type { FallbackProps } from 'react-error-boundary';

export function ErrorFallback({ resetErrorBoundary }: FallbackProps) {
  useEffect(() => { window.dispatchEvent(new Event('usfirst:fatal')); }, []);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold">页面出错了</h1>
      <p className="text-sm text-muted-foreground">页面组件未能加载，请重新打开。你的服务器记录不会被删除。</p>
      <button
        type="button"
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        onClick={resetErrorBoundary}
      >
        重试
      </button>
    </div>
  );
}
