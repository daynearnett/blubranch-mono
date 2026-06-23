// A TextInput that supports inline @-mentions: when the user types "@" + name,
// a floating list of taggable connections (within 3 branches) appears; picking
// one inserts "@First" into the text and records the mention id. Replaces the
// old full-screen tag picker.
import { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';
import { connections, type TaggableUser } from '../lib/api.js';
import { colors, radius, spacing, typography } from '../theme.js';

export interface Mention {
  id: string;
  name: string;
}

const MENTION_FRAGMENT = /@(\w*)$/;

interface Props extends Omit<TextInputProps, 'value' | 'onChangeText' | 'style'> {
  value: string;
  onChangeText: (t: string) => void;
  mentions: Mention[];
  onMentionsChange: (m: Mention[]) => void;
  inputStyle?: TextInputProps['style'];
  containerStyle?: StyleProp<ViewStyle>;
}

export function MentionTextInput({
  value,
  onChangeText,
  mentions,
  onMentionsChange,
  inputStyle,
  containerStyle,
  ...rest
}: Props) {
  const [suggestions, setSuggestions] = useState<TaggableUser[]>([]);
  const [open, setOpen] = useState(false);

  const handleChange = (t: string) => {
    onChangeText(t);
    const m = t.match(MENTION_FRAGMENT); // active @-fragment at the end of the text
    if (m) {
      setOpen(true);
      connections
        .tagSuggestions(m[1])
        .then((r) => setSuggestions(r.items))
        .catch(() => setSuggestions([]));
    } else {
      setOpen(false);
      setSuggestions([]);
    }
  };

  const select = (u: TaggableUser) => {
    onChangeText(value.replace(MENTION_FRAGMENT, `@${u.firstName} `));
    if (!mentions.some((x) => x.id === u.id)) {
      onMentionsChange([...mentions, { id: u.id, name: `${u.firstName} ${u.lastName}` }]);
    }
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {open && suggestions.length > 0 ? (
        <View style={styles.dropdown}>
          {suggestions.map((u) => (
            <Pressable key={u.id} style={styles.row} onPress={() => select(u)}>
              {u.profilePhotoUrl ? (
                <Image source={{ uri: u.profilePhotoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{(u.firstName[0] ?? '').toUpperCase()}</Text>
                </View>
              )}
              <Text style={styles.name}>
                {u.firstName} {u.lastName}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextInput
        value={value}
        onChangeText={handleChange}
        style={inputStyle}
        placeholderTextColor={colors.textSecondary}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  dropdown: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    zIndex: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  avatarFallback: { backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.textInverse, fontSize: 11, fontWeight: '700' },
  name: { ...typography.body, color: colors.textPrimary },
});
