import type { Server } from 'socket.io';
import type { AuthenticatedSocket } from '../lib/socket.js';

/**
 * Real-time message events. The actual message persistence goes through
 * the REST API (POST /conversations/:id/messages) — these handlers are
 * for lightweight real-time signaling only.
 *
 * Events emitted (server → client):
 *   - `message:new`    → { message, conversationId }   (to recipient)
 *   - `message:read`   → { conversationId, readAt, readBy }  (to sender)
 *
 * Events listened (client → server):
 *   - `typing:start`   → { conversationId }
 *   - `typing:stop`    → { conversationId }
 *   - `conversation:join`  → { conversationId }  (subscribe to a chat room)
 *   - `conversation:leave` → { conversationId }  (unsubscribe)
 *
 * Typing indicator design:
 *   The client sends `typing:start` when the user begins typing and
 *   `typing:stop` when they pause for 3s. The server just relays to
 *   the other participants in the conversation room. A 10s server-side
 *   timeout auto-clears stale typing state.
 */
export function registerMessageHandlers(io: Server, socket: AuthenticatedSocket): void {
  const { userId } = socket;
  const typingTimers = new Map<string, NodeJS.Timeout>();

  // Join a conversation room to receive typing indicators + real-time
  // message delivery for that specific chat.
  socket.on('conversation:join', ({ conversationId }: { conversationId: string }) => {
    if (!conversationId || typeof conversationId !== 'string') return;
    socket.join(`conversation:${conversationId}`);
  });

  socket.on('conversation:leave', ({ conversationId }: { conversationId: string }) => {
    if (!conversationId || typeof conversationId !== 'string') return;
    socket.leave(`conversation:${conversationId}`);
  });

  // Typing indicators — relay to the conversation room.
  socket.on('typing:start', ({ conversationId }: { conversationId: string }) => {
    if (!conversationId || typeof conversationId !== 'string') return;

    // Clear any previous timeout for this conversation.
    const existing = typingTimers.get(conversationId);
    if (existing) clearTimeout(existing);

    socket.to(`conversation:${conversationId}`).emit('typing:start', {
      conversationId,
      userId,
    });

    // Auto-clear after 10s in case the client never sends typing:stop.
    typingTimers.set(
      conversationId,
      setTimeout(() => {
        socket.to(`conversation:${conversationId}`).emit('typing:stop', {
          conversationId,
          userId,
        });
        typingTimers.delete(conversationId);
      }, 10000),
    );
  });

  socket.on('typing:stop', ({ conversationId }: { conversationId: string }) => {
    if (!conversationId || typeof conversationId !== 'string') return;

    const existing = typingTimers.get(conversationId);
    if (existing) clearTimeout(existing);
    typingTimers.delete(conversationId);

    socket.to(`conversation:${conversationId}`).emit('typing:stop', {
      conversationId,
      userId,
    });
  });

  // Cleanup all timers on disconnect.
  socket.on('disconnect', () => {
    for (const timer of typingTimers.values()) {
      clearTimeout(timer);
    }
    typingTimers.clear();
  });
}

/**
 * Helper: emit a new message event to all participants of a conversation.
 * Called from the REST message-send endpoint after persisting.
 */
export function emitNewMessage(
  io: Server,
  conversationId: string,
  recipientId: string,
  message: {
    id: string;
    senderId: string;
    content: string;
    createdAt: Date;
  },
): void {
  // Emit to the conversation room (for anyone with the chat open).
  io.to(`conversation:${conversationId}`).emit('message:new', {
    conversationId,
    message,
  });

  // Also emit to the recipient's personal room so they get the badge
  // update even if they're not in the conversation room.
  io.to(`user:${recipientId}`).emit('message:new', {
    conversationId,
    message,
  });
}

/**
 * Helper: emit a read receipt to the sender.
 */
export function emitMessageRead(
  io: Server,
  conversationId: string,
  senderId: string,
  readBy: string,
  readAt: Date,
): void {
  io.to(`user:${senderId}`).emit('message:read', {
    conversationId,
    readBy,
    readAt,
  });
}
