import { useEffect, useRef, useState } from 'react';
import { getMatchSocket } from '../realtime/matchSocket';

const realtimeEvents = [
  'match:state',
  'match:update',
  'score:update',
  'raid:update',
  'player:update',
  'timer:update',
  'match:halftime',
  'match:ended',
];

export const useMatchRealtime = (matchId, { onState, onReconnect } = {}) => {
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const onStateRef = useRef(onState);
  const onReconnectRef = useRef(onReconnect);
  onStateRef.current = onState;
  onReconnectRef.current = onReconnect;

  useEffect(() => {
    if (!matchId) return undefined;
    const socket = getMatchSocket();
    let connectedOnce = false;
    let lastEventId = '';

    const joinMatch = () => socket.emit('match:join', matchId);
    const handleConnect = () => {
      const reconnecting = connectedOnce;
      connectedOnce = true;
      setConnectionStatus('connected');
      joinMatch();
      if (reconnecting) onReconnectRef.current?.();
    };
    const handleDisconnect = () => setConnectionStatus('offline');
    const handleConnectError = () => setConnectionStatus('offline');
    const handleBrowserOffline = () => setConnectionStatus('offline');
    const handleBrowserOnline = () => setConnectionStatus('connecting');
    const handleConnectionStatus = ({ connected }) => setConnectionStatus(connected ? 'connected' : 'offline');
    const handleState = (payload) => {
      const incomingMatchId = payload?.match?._id?.toString?.() ?? payload?.match?._id;
      if (incomingMatchId !== matchId) return;
      const eventId = payload?.event?._id;
      if (eventId && eventId === lastEventId) return;
      if (eventId) lastEventId = eventId;
      onStateRef.current?.(payload);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('connection:status', handleConnectionStatus);
    realtimeEvents.forEach((eventName) => socket.on(eventName, handleState));
    window.addEventListener('offline', handleBrowserOffline);
    window.addEventListener('online', handleBrowserOnline);
    socket.connect();
    if (socket.connected) handleConnect();

    return () => {
      socket.emit('match:leave', matchId);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('connection:status', handleConnectionStatus);
      realtimeEvents.forEach((eventName) => socket.off(eventName, handleState));
      window.removeEventListener('offline', handleBrowserOffline);
      window.removeEventListener('online', handleBrowserOnline);
      socket.disconnect();
    };
  }, [matchId]);

  return connectionStatus;
};
