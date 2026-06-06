import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { messages, users, type PublicProfile } from '../../../src/lib/api.js';
import { colors, spacing, typography } from '../../../src/theme.js';

/**
 * Screen for sending the first message to a user (from quick-message
 * button). Calls POST /messages with recipientId, then redirects to
 * the conversation's chat screen.
 */
export default function NewChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    users.get(userId).then(setProfile).catch(() => {});
  }, [userId]);

  const handleSend = async () => {
    if (!text.trim() || !userId || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await messages.startConversation(userId, text.trim());
      // Replace this screen with the chat screen so back goes to network.
      router.replace(`/(app)/chat/${res.conversation.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      setError(msg);
      setSending(false);
    }
  };

  const name = profile
    ? `${profile.firstName} ${profile.lastName}`
    : 'Loading...';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Back">
          <ArrowLeft color={colors.navy} size={22} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          New message to {name}
        </Text>
      </View>

      {/* Compose area */}
      <View style={styles.body}>
        <Text style={styles.label}>Write your first message:</Text>
        <TextInput
          style={styles.input}
          placeholder="Hey, I'd like to connect about..."
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={5000}
          autoFocus
          accessibilityLabel="Message input"
        />
        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      {/* Send button */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <Pressable
          style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
          accessibilityLabel="Send message"
          accessibilityRole="button"
        >
          {sending ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <>
              <Send color={text.trim() ? colors.textInverse : colors.textMuted} size={16} />
              <Text style={[styles.sendLabel, !text.trim() && styles.sendLabelDisabled]}>
                Send
              </Text>
            </>
          )}
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    gap: 8,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.bodyBold, color: colors.navy, flex: 1 },
  body: { flex: 1, padding: spacing.lg, gap: spacing.md },
  label: { ...typography.body, color: colors.textMuted },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  error: { ...typography.caption, color: colors.danger },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.orange,
    borderRadius: 24,
    height: 48,
    gap: 8,
  },
  sendButtonDisabled: { backgroundColor: colors.surface },
  sendLabel: { ...typography.bodyBold, color: colors.textInverse },
  sendLabelDisabled: { color: colors.textMuted },
});
