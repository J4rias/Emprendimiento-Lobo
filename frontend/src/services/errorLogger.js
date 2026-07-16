import api from './api/axios';

const queue = [];
let flushing = false;

function enqueue(entry) {
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
export function logError(error, source = 'catch') {
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
export function logComponentError(error, componentStack) {
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
