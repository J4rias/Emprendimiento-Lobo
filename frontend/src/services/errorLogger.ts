import api from './api/axios';

interface ErrorEntry {
  message: string;
  stack: string | null;
  source: string;
  extra?: Record<string, unknown>;
  url?: string;
  userAgent?: string;
  timestamp?: string;
}

const queue: ErrorEntry[] = [];
let flushing = false;

function enqueue(entry: Omit<ErrorEntry, 'url' | 'userAgent' | 'timestamp'>) {
  queue.push({
    ...entry,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  });
  flush();
}

async function flush() {
  if (flushing || queue.length === 0) return;
  flushing = true;

  while (queue.length > 0) {
    const entry = queue.shift();
    try {
      await api.post('/client-errors', entry);
    } catch {
      // If the backend is down, don't lose the error — just drop it silently
    }
  }
  flushing = false;
}

/**
 * Log a caught error (try/catch, mutation onError, etc.)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logError(error: any, source = 'catch') {
  const message = error?.response?.data?.message || error?.message || String(error);
  const stack = error?.stack || null;
  const extra = error?.response
    ? { status: error.response.status, url: error.config?.url, method: error.config?.method }
    : undefined;

  enqueue({ message, stack, source, extra });
}

/**
 * Log a React ErrorBoundary crash
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logComponentError(error: any, componentStack?: string) {
  enqueue({
    message: error?.message || String(error),
    stack: error?.stack || null,
    source: 'ErrorBoundary',
    extra: { componentStack },
  });
}

// Catch unhandled errors globally
window.addEventListener('error', (event) => {
  enqueue({
    message: event.message,
    stack: event.error?.stack || null,
    source: 'window.onerror',
    extra: { filename: event.filename, lineno: event.lineno, colno: event.colno },
  });
});

// Catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  enqueue({
    message: error?.message || String(error),
    stack: error?.stack || null,
    source: 'unhandledrejection',
  });
});
