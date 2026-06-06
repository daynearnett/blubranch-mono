import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Platform } from 'react-native';

// Same base URL logic as api.ts.
function getBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000';
  return 'http://localhost:4000';
}

let sharedSocket: Socket | null = null;

interface UseSocketOpts {
  /** JWT access token — socket won't connect without one. */
  accessToken: string | null;
  /** Called when any new message arrives (conversation list badge). */
  onNewMessage?: (data: { conversationId: string; message: MessagePayload }) => void;
  /** Called when messages are marked read. */
  onMessageRead?: (data: { conversationId: string; readBy: string; readAt: string }) => void;
}

export interface MessagePayload {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
}

/**
 * Singleton Socket.io connection that auto-connects on sign-in and
 * disconnects on sign-out. Uses the shared access token from auth.
 *
 * Multiple components can call useSocket() — they all share the same
 * underlying connection. The first call with a valid token opens it;
 * subsequent calls just attach listeners.
 */
export function useSocket({ accessToken, onNewMessage, onMessageRead }: UseSocketOpts) {
  const [connected, setConnected] = useState(false);
  const onNewMessageRef = useRef(onNewMessage);
  const onMessageReadRef = useRef(onMessageRead);
  onNewMessageRef.current = onNewMessage;
  onMessageReadRef.current = onMessageRead;

  useEffect(() => {
    if (!accessToken) {
      // Sign-out: tear down the socket.
      if (sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
      }
      setConnected(false);
      return;
    }

    // Create or reconnect.
    if (!sharedSocket || sharedSocket.disconnected) {
      sharedSocket = io(getBaseUrl(), {
        auth: { token: accessToken },
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      });
    }

    const socket = sharedSocket;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onNewMsg = (data: { conversationId: string; message: MessagePayload }) => {
      onNewMessageRef.current?.(data);
    };
    const onRead = (data: { conversationId: string; readBy: string; readAt: string }) => {
      onMessageReadRef.current?.(data);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('message:new', onNewMsg);
    socket.on('message:read', onRead);

    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('message:new', onNewMsg);
      socket.off('message:read', onRead);
    };
  }, [accessToken]);

  // ── Typing indicators ─────────────────────────────────────────
  const joinConversation = useCallback((conversationId: string) => {
    sharedSocket?.emit('conversation:join', { conversationId });
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    sharedSocket?.emit('conversation:leave', { conversationId });
  }, []);

  const startTyping = useCallback((conversationId: string) => {
    sharedSocket?.emit('typing:start', { conversationId });
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    sharedSocket?.emit('typing:stop', { conversationId });
  }, []);

  // ── Presence heartbeat ────────────────────────────────────────
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => {
      sharedSocket?.emit('presence:heartbeat');
    }, 60000); // every 60s
    return () => clearInterval(interval);
  }, [connected]);

  return {
    connected,
    socket: sharedSocket,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping,
  };
}
