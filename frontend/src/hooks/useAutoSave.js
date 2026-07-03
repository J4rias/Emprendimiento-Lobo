import { useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Hook genérico de auto-guardado con debounce, cola por clave y gestión de errores.
 *
 * @param {object} options
 * @param {(data: any) => Promise<any>} options.saveFn  - Función async que realiza el guardado
 * @param {number} [options.delay=800]                   - Milisegundos de debounce por clave
 * @param {(conflictData: any) => void} [options.onConflict] - Callback cuando el servidor retorna 409
 * @param {(err: any, key: string, data: any) => void} [options.onError] - Callback adicional de error
 *
 * @returns {{ save, cancel, status, lastSaved, errorKeys }}
 *   - save(key, data): Programa un guardado con debounce para la clave indicada
 *   - cancel(key): Cancela el guardado pendiente de una clave
 *   - status: 'idle' | 'saving' | 'saved' | 'error'
 *   - lastSaved: Date del último guardado exitoso
 *   - errorKeys: Set de claves que tienen error pendiente
 */
export function useAutoSave({ saveFn, delay = 800, onConflict, onError }) {
    const timers = useRef({});
    const [saving, setSaving] = useState(new Set());
    const [lastSaved, setLastSaved] = useState(null);
    const [errorKeys, setErrorKeys] = useState(new Set());

    const save = useCallback((key, data) => {
        // Limpiar error previo de esta clave al intentar nuevamente
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
                if (err.response?.status === 409) {
                    toast.error('Otro usuario modificó este precio. Recargando lista...', { duration: 5000 });
                    onConflict?.(err.response.data);
                } else if (err.response?.status === 404) {
                    toast.error('Lista de precios no encontrada. Puede haber sido eliminada.');
                    setErrorKeys(prev => new Set(prev).add(key));
                } else if (err.response?.status === 401 || err.response?.status === 403) {
                    toast.error('Sin permiso para editar esta lista de precios.');
                    setErrorKeys(prev => new Set(prev).add(key));
                } else if (!err.response) {
                    // Sin conexión o timeout de red
                    toast.error('Sin conexión. Verifica tu red e intenta de nuevo.', { id: 'network-error' });
                    setErrorKeys(prev => new Set(prev).add(key));
                } else {
                    const msg = err.response?.data?.message || 'Error al guardar precio';
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

    const cancel = useCallback((key) => {
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
