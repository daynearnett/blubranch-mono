// "Worked together" vouch bottom sheet. Opened from another worker's profile.
//
// A vouch is one fixed sentence — "Worked together. Would work with them
// again." — plus optional shared context (company + years). Shared-workplace
// suggestions from GET /users/:id/vouch-context pre-fill the context; manual
// entry covers everyone else. If the viewer already vouched for this person
// (context.given), the sheet shows that state instead of the form.
//
// Modal is dismissible via backdrop tap or ✕. The parent owns visibility,
// fetches the context, and gets the created vouch back via onVouched.

import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check, X } from 'lucide-react-native';
import { Button, Chip, Input } from './ui.js';
import { ApiError, vouches, type VouchContext, type VouchRecord } from '../lib/api.js';
import { colors, radius, spacing, typography } from '../theme.js';

interface Props {
  visible: boolean;
  /** The user being vouched for. */
  userId: string;
  firstName: string;
  /** Vouch context (existing vouch + shared-workplace suggestions). Null while loading. */
  context: VouchContext | null;
  onClose: () => void;
  /** Called after a successful vouch. Use to swap the profile button to "Vouched". */
  onVouched?: (vouch: VouchRecord) => void;
}

export function VouchSheet({ visible, userId, firstName, context, onClose, onVouched }: Props) {
  const [companyName, setCompanyName] = useState('');
  const [startYear, setStartYear] = useState('');
  const [endYear, setEndYear] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset every time the sheet opens.
  useEffect(() => {
    if (visible) {
      setCompanyName('');
      setStartYear('');
      setEndYear('');
      setSubmitting(false);
      setSent(false);
      setError(null);
    }
  }, [visible, userId]);

  const applySuggestion = (s: { companyName: string; startYear: string; endYear: string }) => {
    setCompanyName(s.companyName);
    setStartYear(s.startYear);
    setEndYear(s.endYear);
  };

  const submit = async () => {
    const badYear = (y: string) => y.length > 0 && !/^\d{4}$/.test(y);
    if (badYear(startYear) || badYear(endYear)) {
      setError('Years need all 4 digits (like 2023)');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const vouch = await vouches.create(userId, {
        companyName: companyName.trim() || undefined,
        startYear: startYear || undefined,
        endYear: endYear || undefined,
      });
      setSent(true);
      onVouched?.(vouch);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the vouch');
    } finally {
      setSubmitting(false);
    }
  };

  const given = context?.given ?? null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdropWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Worked together?</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
              <X color={colors.textMuted} size={20} strokeWidth={2} />
            </Pressable>
          </View>

          {sent || given ? (
            <View style={styles.doneState}>
              <View style={styles.doneCheck}>
                <Check color={colors.textInverse} size={22} strokeWidth={2.5} />
              </View>
              <Text style={styles.doneTitle}>
                {sent
                  ? `Vouch sent — waiting on ${firstName} to confirm`
                  : given?.status === 'confirmed'
                    ? 'You vouched for them'
                    : 'You vouched for them — pending their confirmation'}
              </Text>
              <Text style={styles.doneBody}>
                Confirmed vouches show on their profile with your name on it.
              </Text>
              <Button label="Done" variant="outline" onPress={onClose} style={styles.doneBtn} />
            </View>
          ) : (
            <View>
              <Text style={styles.quote}>
                “Worked together. Would work with them again.”
              </Text>

              {context && context.suggestions.length > 0 ? (
                <View style={styles.suggestBlock}>
                  <Text style={styles.suggestLabel}>You both list</Text>
                  <View style={styles.suggestRow}>
                    {context.suggestions.map((s) => (
                      <Chip
                        key={s.companyName}
                        label={`${s.companyName} · ${s.startYear}–${s.endYear}`}
                        active={companyName === s.companyName}
                        onPress={() => applySuggestion(s)}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <Input
                label="Where'd you work together? (optional)"
                placeholder="Company or job site"
                value={companyName}
                onChangeText={setCompanyName}
                maxLength={200}
              />
              <View style={styles.yearRow}>
                <Input
                  label="From (optional)"
                  placeholder="2023"
                  value={startYear}
                  onChangeText={setStartYear}
                  keyboardType="number-pad"
                  maxLength={4}
                  containerStyle={styles.yearField}
                />
                <Input
                  label="To (optional)"
                  placeholder="2024"
                  value={endYear}
                  onChangeText={setEndYear}
                  keyboardType="number-pad"
                  maxLength={4}
                  containerStyle={styles.yearField}
                />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button
                label={`Vouch for ${firstName}`}
                onPress={submit}
                loading={submitting}
              />
              <Text style={styles.footnote}>
                {firstName} confirms it before it shows anywhere.
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,29,46,0.5)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { ...typography.h2, color: colors.navy },
  quote: {
    ...typography.body,
    color: colors.textBody,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  suggestBlock: { marginBottom: spacing.sm },
  suggestLabel: {
    ...typography.small,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap' },
  yearRow: { flexDirection: 'row', gap: spacing.md },
  yearField: { flex: 1 },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },
  footnote: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  doneState: { alignItems: 'center', paddingVertical: spacing.lg },
  doneCheck: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  doneTitle: { ...typography.h3, color: colors.navy, textAlign: 'center' },
  doneBody: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  doneBtn: { alignSelf: 'stretch', marginTop: spacing.lg },
});
