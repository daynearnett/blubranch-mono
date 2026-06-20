// Multi-select picker of the user's connections — used to tag people in posts
// and comments. Returns the chosen {id, name} list.
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Search, X } from 'lucide-react-native';
import { connections, type ConnectionItem } from '../lib/api.js';
import { colors, radius, spacing, typography } from '../theme.js';

export interface TaggedUser {
  id: string;
  name: string;
}

export function ConnectionPicker({
  visible,
  selected,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  selected: TaggedUser[];
  onClose: () => void;
  onConfirm: (users: TaggedUser[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<ConnectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<TaggedUser[]>(selected);

  useEffect(() => {
    if (visible) setPicked(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    connections
      .list({ search: search.trim() || undefined })
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [visible, search]);

  const toggle = (id: string, name: string) => {
    setPicked((prev) =>
      prev.some((p) => p.id === id) ? prev.filter((p) => p.id !== id) : [...prev, { id, name }],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} style={styles.iconBtn} accessibilityLabel="Cancel">
            <X color={colors.navy} size={22} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>Tag connections</Text>
          <Pressable
            onPress={() => {
              onConfirm(picked);
              onClose();
            }}
            style={styles.doneBtn}
          >
            <Text style={styles.doneText}>Done{picked.length ? ` (${picked.length})` : ''}</Text>
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Search color={colors.textMuted} size={16} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search connections…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.orange} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(c) => c.user.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {search ? 'No connections match.' : 'Connect with people to tag them.'}
              </Text>
            }
            renderItem={({ item }) => {
              const name = `${item.user.firstName} ${item.user.lastName}`;
              const isPicked = picked.some((p) => p.id === item.user.id);
              return (
                <Pressable style={styles.row} onPress={() => toggle(item.user.id, name)}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {`${item.user.firstName[0] ?? ''}${item.user.lastName[0] ?? ''}`.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.name}>{name}</Text>
                  <View style={[styles.checkbox, isPicked && styles.checkboxOn]}>
                    {isPicked ? <Check color={colors.textInverse} size={14} strokeWidth={3} /> : null}
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h3, flex: 1, textAlign: 'center', color: colors.navy },
  doneBtn: { paddingHorizontal: spacing.sm, height: 36, justifyContent: 'center' },
  doneText: { ...typography.bodyBold, color: colors.orange },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.lg,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary },
  list: { paddingHorizontal: spacing.lg, flexGrow: 1 },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.textInverse, fontSize: 14, fontWeight: '700' },
  name: { ...typography.body, color: colors.textPrimary, flex: 1 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.orange, borderColor: colors.orange },
});
