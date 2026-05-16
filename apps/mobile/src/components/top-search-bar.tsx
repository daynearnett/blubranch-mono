import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MessageSquare, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '../theme.js';

interface TopSearchBarProps {
  avatarInitials?: string;
  avatarColor?: string;
  isVerified?: boolean;
  unreadMessages?: number;
  placeholder?: string;
}

export function TopSearchBar({
  avatarInitials = '??',
  avatarColor = colors.navy,
  unreadMessages = 0,
  placeholder = 'Search jobs, people, trades...',
}: TopSearchBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <Pressable
        style={[styles.avatar, { backgroundColor: avatarColor }]}
        onPress={() => router.push('/(app)/(tabs)/profile')}
        accessibilityLabel="My profile"
        accessibilityRole="button"
      >
        <Text style={styles.avatarText}>{avatarInitials}</Text>
      </Pressable>

      <Pressable
        style={styles.searchPill}
        onPress={() => {/* TODO: navigate to search screen */}}
        accessibilityLabel="Search"
        accessibilityRole="search"
      >
        <Search color={colors.textMuted} size={16} strokeWidth={2} />
        <Text style={styles.searchText}>{placeholder}</Text>
      </Pressable>

      <Pressable
        style={styles.msgButton}
        onPress={() => {/* TODO: navigate to messages */}}
        accessibilityLabel={`Messages${unreadMessages > 0 ? `, ${unreadMessages} unread` : ''}`}
        accessibilityRole="button"
      >
        <MessageSquare color={colors.navy} size={22} strokeWidth={1.8} />
        {unreadMessages > 0 && (
          <View style={styles.unreadDot} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: 10,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: '700',
  },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 36,
    gap: 8,
  },
  searchText: {
    ...typography.body,
    color: colors.textMuted,
  },
  msgButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.orange,
  },
});
