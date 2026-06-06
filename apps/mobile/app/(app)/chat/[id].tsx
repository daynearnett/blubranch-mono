import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { messages, type MessageItem, type ConversationPreview } from '../../../src/lib/api.js';
import { useSocket } from '../../../src/hooks/useSocket.js';
import { useAuth } from '../../../src/lib/auth-context.js';
import { secureStorage } from '../../../src/lib/storage.js';
import { colors, radius, spacing, typography } from '../../../src/theme.js';

export default function ChatScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id;

  const [messageList, setMessageList] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [otherUser, setOtherUser] = useState<ConversationPreview['otherUser'] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingRef = useRef(0);

  // Get access token from storage for socket.
  const [accessToken, setAccessToken] = useState<string | null>(null);
  useEffect(() => {
    secureStorage.getItem('bb.access').then(setAccessToken);
  }, []);

  const { joinConversation, leaveConversation, startTyping, stopTyping, socket } = useSocket({
    accessToken,
    onNewMessage: (data) => {
      if (data.conversationId === conversationId) {
        const msg: MessageItem = { ...data.message, readAt: null };
        setMessageList((prev) => [msg, ...prev]);
        // Auto-mark as read since we're viewing this conversation.
        messages.markRead(conversationId!).catch(() => {});
      }
    },
  });

  // Join/leave conversation room for typing indicators.
  useEffect(() => {
    if (!conversationId) return;
    joinConversation(conversationId);
    return () => leaveConversation(conversationId);
  }, [conversationId, joinConversation, leaveConversation]);

  // Listen for typing indicators.
  useEffect(() => {
    if (!socket) return;
    const onTypingStart = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId === conversationId && data.userId !== userId) {
        setTypingUserId(data.userId);
      }
    };
    const onTypingStop = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId === conversationId && data.userId !== userId) {
        setTypingUserId(null);
      }
    };
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    return () => {
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
    };
  }, [socket, conversationId, userId]);

  // Load initial messages.
  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const res = await messages.thread(conversationId);
      setMessageList(res.messages);
      setNextCursor(res.nextCursor);
      // Mark as read.
      await messages.markRead(conversationId);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  // Load conversation metadata (other user info).
  useEffect(() => {
    if (!conversationId) return;
    messages.conversations().then((res) => {
      const convo = res.conversations.find((c) => c.id === conversationId);
      if (convo) setOtherUser(convo.otherUser);
    });
    loadMessages();
  }, [conversationId, loadMessages]);

  // Load more (older messages) on scroll to end.
  const loadMore = async () => {
    if (!nextCursor || !conversationId) return;
    try {
      const res = await messages.thread(conversationId, { cursor: nextCursor });
      setMessageList((prev) => [...prev, ...res.messages]);
      setNextCursor(res.nextCursor);
    } catch {
      // silent
    }
  };

  // Handle text change + typing indicator debounce.
  const onChangeText = (value: string) => {
    setText(value);
    if (!conversationId) return;
    const now = Date.now();
    if (now - lastTypingRef.current > 2000) {
      startTyping(conversationId);
      lastTypingRef.current = now;
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(conversationId);
    }, 3000);
  };

  const handleSend = async () => {
    if (!text.trim() || !conversationId || sending) return;
    setSending(true);
    const content = text.trim();
    setText('');
    stopTyping(conversationId);

    try {
      const res = await messages.send(conversationId, content);
      setMessageList((prev) => [res.message, ...prev]);
    } catch {
      // Restore text on failure.
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const initials = otherUser
    ? `${otherUser.firstName?.[0] ?? ''}${otherUser.lastName?.[0] ?? ''}`
    : '';

  function renderMessage({ item }: { item: MessageItem }) {
    const isMe = item.senderId === userId;
    return (
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
          {item.content}
        </Text>
        <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
          {new Date(item.createdAt).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Back">
          <ArrowLeft color={colors.navy} size={22} />
        </Pressable>
        {otherUser?.profilePhotoUrl ? (
          <Image source={{ uri: otherUser.profilePhotoUrl }} style={styles.headerAvatar} />
        ) : (
          <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
            <Text style={styles.headerAvatarText}>{initials}</Text>
          </View>
        )}
        <Text style={styles.headerName} numberOfLines={1}>
          {otherUser ? `${otherUser.firstName} ${otherUser.lastName}` : 'Chat'}
        </Text>
      </View>

      {/* Typing indicator */}
      {typingUserId && (
        <View style={styles.typingBar}>
          <Text style={styles.typingText}>typing...</Text>
        </View>
      )}

      {/* Messages */}
      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.orange} size="large" />
      ) : (
        <FlatList
          data={messageList}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.messages}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
        />
      )}

      {/* Composer */}
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={onChangeText}
          multiline
          maxLength={5000}
          accessibilityLabel="Message input"
        />
        <Pressable
          style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
          accessibilityLabel="Send message"
          accessibilityRole="button"
        >
          <Send color={text.trim() && !sending ? colors.textInverse : colors.textMuted} size={18} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    gap: 10,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { width: 32, height: 32, borderRadius: 16 },
  headerAvatarPlaceholder: {
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { color: colors.textInverse, fontSize: 12, fontWeight: '700' },
  headerName: { ...typography.bodyBold, color: colors.navy, flex: 1 },
  typingBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 4,
    backgroundColor: colors.surface,
  },
  typingText: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
  loader: { flex: 1, justifyContent: 'center' },
  messages: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    marginBottom: 6,
  },
  bubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: colors.orange,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { ...typography.body, lineHeight: 20 },
  bubbleTextMe: { color: colors.textInverse },
  bubbleTextThem: { color: colors.text },
  bubbleTime: { ...typography.caption, color: colors.textMuted, fontSize: 10, marginTop: 4 },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.7)' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.background,
    gap: 8,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: colors.surface },
});
