// Toolbox Talk (E2) — the daily code/safety question card at the top of the
// feed. Answer once a day, see the explanation, keep the streak alive.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Flame, HardHat } from 'lucide-react-native';
import { toolbox, type ToolboxToday } from '../lib/api.js';
import { colors, radius, spacing, typography } from '../theme.js';

export function ToolboxCard() {
  const [data, setData] = useState<ToolboxToday | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    toolbox.today().then(setData).catch(() => {});
  }, []);

  if (!data) return null;
  const answered = data.answered;

  const onAnswer = async (choiceIndex: number) => {
    if (answered || submitting) return;
    setSubmitting(true);
    try {
      const res = await toolbox.answer(choiceIndex);
      setData({
        ...data,
        answered: {
          choiceIndex,
          correct: res.correct,
          correctIndex: res.correctIndex,
          explanation: res.explanation,
        },
        streak: res.streak,
      });
    } catch {
      // Refetch so a same-day double-answer (409) settles into answered state.
      toolbox.today().then(setData).catch(() => {});
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <HardHat color={colors.navy} size={16} strokeWidth={2} />
          <Text style={styles.title}>Toolbox Talk</Text>
        </View>
        {data.streak > 0 ? (
          <View style={styles.streak}>
            <Flame color={colors.orange} size={13} strokeWidth={2} />
            <Text style={styles.streakLabel}>
              {data.streak} day{data.streak === 1 ? '' : 's'}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.question}>{data.question.question}</Text>

      {data.question.choices.map((choice, i) => {
        const isPicked = answered?.choiceIndex === i;
        const isCorrect = answered && i === answered.correctIndex;
        return (
          <Pressable
            key={i}
            style={[
              styles.choice,
              isCorrect && styles.choiceCorrect,
              isPicked && !isCorrect && styles.choiceWrong,
            ]}
            onPress={() => onAnswer(i)}
            disabled={!!answered || submitting}
          >
            <Text
              style={[
                styles.choiceLabel,
                isCorrect && styles.choiceLabelCorrect,
                isPicked && !isCorrect && styles.choiceLabelWrong,
              ]}
            >
              {choice}
            </Text>
          </Pressable>
        );
      })}

      {answered ? (
        <Text style={styles.explanation}>
          {answered.correct ? 'Right on. ' : 'Not this time. '}
          {answered.explanation}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...typography.bodyBold, color: colors.navy },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  streakLabel: { ...typography.small, color: colors.orange, fontWeight: '700' },
  question: { ...typography.body, color: colors.textPrimary, marginBottom: spacing.sm },
  choice: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  choiceCorrect: { borderColor: colors.success, backgroundColor: '#EDF7EE' },
  choiceWrong: { borderColor: colors.danger, backgroundColor: '#FDF0EF' },
  choiceLabel: { ...typography.small, color: colors.textPrimary },
  choiceLabelCorrect: { color: colors.success, fontWeight: '700' },
  choiceLabelWrong: { color: colors.danger, fontWeight: '600' },
  explanation: { ...typography.small, color: colors.textSecondary, marginTop: spacing.xs },
});
