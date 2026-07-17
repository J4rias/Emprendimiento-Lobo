import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { usePOSStore } from '../stores/posStore';

interface UsePOSSocketOptions {
  sessionId: string;
  tabId: string | null;
  token: string | null;
  isEnabled?: boolean;
}

export function usePOSSocket({ sessionId, tabId, token, isEnabled = true }: UsePOSSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const updateReservation = usePOSStore((state) => state.updateReservation);
  const setOtherReservations = usePOSStore((state) => state.setOtherReservations);

  useEffect(() => {
    if (!isEnabled || !token || !sessionId) {
      return;
    }

    const apiUrl = import.meta.env.VITE_API_URL;
    const backendUrl = apiUrl ? new URL(apiUrl).origin : window.location.origin;

    const socket = io(backendUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      if (tabId) {
        socket.emit('pos:join', {
          session_id: sessionId,
          tab_id: tabId
        });
      }
    });

    socket.on('reservations:init', (data: Record<number, number>) => {
      setOtherReservations(data);
    });

    socket.on('reservation:changed', ({ product_id, total_reserved }: { product_id: number; total_reserved: number; action: string }) => {
      updateReservation(product_id, total_reserved);
    });

    socket.on('reconnect', () => {
      if (tabId) {
        socket.emit('pos:join', {
          session_id: sessionId,
          tab_id: tabId
        });
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isEnabled, token, sessionId, tabId, updateReservation, setOtherReservations]);

  return socketRef;
}
