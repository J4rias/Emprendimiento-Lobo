import { useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';

interface UseAutoSaveOptions {
  saveFn: (data: unknown) => Promise<unknown>;
  delay?: number;
  onConflict?: (conflictData: unknown) => void;
  onError?: (err: unknown, key: string, data: unknown) => void;
}

export function useAutoSave({ saveFn, delay = 800, onConflict, onError }: UseAutoSaveOptions) {
    const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const [saving, setSaving] = useState<Set<string>>(new Set());
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [errorKeys, setErrorKeys] = useState<Set<string>>(new Set());

    const save = useCallback((key: string, data: unknown) => {
        setErrorKeys(prev => {
            if (!prev.has(key)) return prev;
            const s = new Set(prev);
            s.delete(key);
            return s;
        });

        clearTimeout(timers.current[key]);
        timers.current[key] = setTimeout(async () => {
            setSaving(prev => new Set(prev).add(key));
            try {
                await saveFn(data);
                setLastSaved(new Date());
            } catch (err) {
                const axErr = err as AxiosError<{ message?: string }>;
                if (axErr.response?.status === 409) {
                    toast.error('Otro usuario modificó este precio. Recargando lista...', { duration: 5000 });
                    onConflict?.(axErr.response.data);
                } else if (axErr.response?.status === 404) {
                    toast.error('Lista de precios no encontrada. Puede haber sido eliminada.');
                    setErrorKeys(prev => new Set(prev).add(key));
                } else if (axErr.response?.status === 401 || axErr.response?.status === 403) {
                    toast.error('Sin permiso para editar esta lista de precios.');
                    setErrorKeys(prev => new Set(prev).add(key));
                } else if (!axErr.response) {
                    toast.error('Sin conexión. Verifica tu red e intenta de nuevo.', { id: 'network-error' });
                    setErrorKeys(prev => new Set(prev).add(key));
                } else {
                    const msg = axErr.response?.data?.message || 'Error al guardar precio';
                    toast.error(msg);
                    setErrorKeys(prev => new Set(prev).add(key));
                }
                onError?.(err, key, data);
            } finally {
                setSaving(prev => {
                    const s = new Set(prev);
                    s.delete(key);
                    return s;
                });
            }
        }, delay);
    }, [saveFn, delay, onConflict, onError]);

    const cancel = useCallback((key: string) => {
        clearTimeout(timers.current[key]);
        setSaving(prev => {
            const s = new Set(prev);
            s.delete(key);
            return s;
        });
    }, []);

    const status = errorKeys.size > 0 ? 'error' : saving.size > 0 ? 'saving' : lastSaved ? 'saved' : 'idle';

    return { save, cancel, status, lastSaved, errorKeys };
}
