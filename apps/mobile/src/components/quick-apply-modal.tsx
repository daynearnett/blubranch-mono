// Quick Apply bottom sheet. Triggered from:
//   • JobDetailBody (Mockup 6B sticky bar)
//   • JobCard (Job Board + Home Feed)
//
// Two paths to submission:
//   1. "Send Application" — submits with the typed message
//   2. "Skip & Apply"     — submits with an empty message (the original
//                            zero-friction flow before this modal was added)
//
// Modal is dismissible via backdrop tap or ✕. The parent owns visibility +
// the optional onApplied callback (used to refresh the screen behind).

import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from './ui.js';
import { ApiError, jobs as jobsApi } from '../lib/api.js';
import { colors, radius, spacing, typography } from '../theme.js';

const MAX = 500;

export interface QuickApplyTarget {
  id: string;
  title: string;
  companyName: string;
}

interface Props {
  visible: boolean;
  job: QuickApplyTarget | null;
  onClose: () => void;
  /** Called after a successful apply. Use to refresh the underlying screen. */
  onApplied?: (target: QuickApplyTarget) => void;
}

export function QuickApplyModal({ visible, job, onClose, onApplied }: Props) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state every time we open against a different job.
  useEffect(() => {
    if (visible) {
      setMessage('');
      setError(null);
      setSubmitting(false);
    }
  }, [visible, job?.id]);

  const submit = async (msg: string) => {
    if (!job) return;
    setSubmitting(true);
    setError(null);
    try {
      const trimmed = msg.trim();
      await jobsApi.apply(job.id, trimmed ? { message: trimmed } : {});
      onApplied?.(job);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not apply');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Backdrop tap dismisses */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <View style={styles.grabHandle} />

            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>QUICK APPLY</Text>
                {job ? (
                  <>
                    <Text style={styles.jobTitle} numberOfLines={2}>
                      {job.title}
                    </Text>
                    <Text style={styles.companyName} numberOfLines={1}>
                      {job.companyName}
                    </Text>
                  </>
                ) : null}
              </View>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Add a message (optional)</Text>
            <TextInput
              value={message}
              onChangeText={(v) => setMessage(v.slice(0, MAX))}
              multiline
              numberOfLines={4}
              maxLength={MAX}
              placeholder="Anything the employer should know up front?"
              placeholderTextColor={colors.textSecondary}
              style={styles.textarea}
              editable={!submitting}
            />
            <Text style={styles.counter}>
              {message.length} / {MAX}
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              label="Send Application"
              onPress={() => submit(message)}
              loading={submitting}
            />
            <Pressable
              onPress={() => submit('')}
              disabled={submitting}
              style={styles.skipBtn}
              accessibilityLabel="Skip and apply with no message"
            >
              <Text style={styles.skipLabel}>Skip & Apply</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetWrap: { width: '100%' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    // Center horizontally on tablet/desktop and cap width so the sheet
    // doesn't stretch the full viewport.
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
  },
  grabHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  jobTitle: { ...typography.h3, color: colors.primaryDark, marginBottom: 2 },
  companyName: { ...typography.small, color: colors.textSecondary },
  close: {
    fontSize: 18,
    color: colors.textSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  label: {
    ...typography.small,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  textarea: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    textAlignVertical: 'top',
    fontSize: typography.body.fontSize,
  },
  counter: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  error: {
    ...typography.small,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  skipBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  skipLabel: {
    ...typography.body,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
