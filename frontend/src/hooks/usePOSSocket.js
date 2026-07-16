import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { usePOSStore } from '../stores/posStore';

/**
 * WebSocket hook for POS real-time synchronization
 * Connects to server via Socket.io and listens for reservation updates
 */
export function usePOSSocket({ sessionId, tabId, token, isEnabled = true }) {
  const socketRef = useRef(null);
  const updateReservation = usePOSStore((state) => state.updateReservation);
  const setOtherReservations = usePOSStore((state) => state.setOtherReservations);

  useEffect(() => {
    if (!isEnabled || !token || !sessionId) {
      return;
    }

    // Extract origin only — Socket.io interprets paths as namespaces
    const apiUrl = import.meta.env.VITE_API_URL;
    const backendUrl = apiUrl ? new URL(apiUrl).origin : window.location.origin;

    // Connect to Socket.io
    const socket = io(backendUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socketRef.current = socket;

    // On successful connection
    socket.on('connect', () => {
      console.log('🔗 WebSocket connected to POS server');

      // Notify server that this tab is ready
      if (tabId) {
        socket.emit('pos:join', {
          session_id: sessionId,
          tab_id: tabId
        });
      }
    });

    // Receive initial state of all reservations
    socket.on('reservations:init', (data) => {
      console.log('📦 Received initial reservations:', data);
      setOtherReservations(data);
    });

    // Receive real-time updates when any reservation changes
    socket.on('reservation:changed', ({ product_id, total_reserved, action }) => {
      console.log(`📢 Reservation changed for product ${product_id}:`, action, total_reserved);
      updateReservation(product_id, total_reserved);
    });

    // Reconnection event
    socket.on('reconnect', () => {
      console.log('🔄 Reconnected to POS server');
      if (tabId) {
        socket.emit('pos:join', {
          session_id: sessionId,
          tab_id: tabId
        });
      }
    });

    // Error handling
    socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
    });

    socket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isEnabled, token, sessionId, tabId, updateReservation, setOtherReservations]);

  return socketRef;
}
