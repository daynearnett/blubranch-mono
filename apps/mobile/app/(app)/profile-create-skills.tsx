// Mockup screen 3B — Profile creation step 2 of 4: Skills & certs
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card, Chip, Input, ProgressDots } from '../../src/components/ui.js';
import { ApiError, me, reference, type MeResponse } from '../../src/lib/api.js';
import { colors, spacing, typography } from '../../src/theme.js';

interface Skill {
  id: number;
  name: string;
  tradeId: number | null;
}

export default function ProfileCreateSkills() {
  const router = useRouter();
  const [meData, setMeData] = useState<MeResponse | null>(null);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [certName, setCertName] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [busy, setBusy] = useState(false);

  // Load /me + skills filtered to user's trades.
  useEffect(() => {
    (async () => {
      try {
        const data = await me.get();
        setMeData(data);
        setSelected(data.skills.map((s) => s.id));
        const tradeIds = data.trades.map((t) => t.id);
        if (tradeIds.length === 0) {
          setAllSkills(await reference.skills());
        } else {
          // /reference/skills supports a single tradeId; merge per-trade lists.
          const lists = await Promise.all(tradeIds.map((id) => reference.skills(id)));
          const seen = new Set<number>();
          const merged: Skill[] = [];
          for (const list of lists) {
            for (const s of list) {
              if (!seen.has(s.id)) {
                seen.add(s.id);
                merged.push(s);
              }
            }
          }
          setAllSkills(merged);
        }
      } catch (err) {
        Alert.alert('Could not load profile', err instanceof ApiError ? err.message : 'Try again');
      }
    })();
  }, []);

  const toggle = (id: number) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= 8) {
        Alert.alert('Max reached', 'Pick up to 8 skills.');
        return prev;
      }
      return [...prev, id];
    });
  };

  const addCertification = async () => {
    if (!certName.trim()) return;
    setBusy(true);
    try {
      await me.addCertification({
        name: certName.trim(),
        certificationNumber: certNumber.trim() || null,
      });
      const refreshed = await me.get();
      setMeData(refreshed);
      setCertName('');
      setCertNumber('');
    } catch (err) {
      Alert.alert(
        'Could not add certification',
        err instanceof ApiError ? err.message : 'Try again',
      );
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    setBusy(true);
    try {
      await me.setSkills({ skillIds: selected });
      if (hourlyRate) {
        const rate = Number(hourlyRate);
        if (!Number.isNaN(rate)) {
          await me.updateWorkerProfile({ hourlyRate: rate });
        }
      }
      router.push('/(app)/profile-create-photos');
    } catch (err) {
      Alert.alert('Could not save', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View>
          <ProgressDots count={4} current={1} />
          <Text style={styles.title}>Top skills & certifications</Text>
          <Text style={styles.subtitle}>Step 2 of 4 — pick up to 8 skills</Text>

          <View style={styles.chipWrap}>
            {allSkills.map((s) => (
              <Chip
                key={s.id}
                label={s.name}
                active={selected.includes(s.id)}
                onPress={() => toggle(s.id)}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Licenses & certifications</Text>
          {meData?.certifications.map((c) => (
            <Card key={c.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={typography.bodyBold}>{c.name}</Text>
                {c.certificationNumber ? (
                  <Text style={styles.certNumber}>#{c.certificationNumber}</Text>
                ) : null}
              </View>
              {c.isVerified ? <Badge label="Verified" tone="success" /> : null}
            </Card>
          ))}

          <Input label="Certification name" value={certName} onChangeText={setCertName} />
          <Input
            label="Number (optional)"
            value={certNumber}
            onChangeText={setCertNumber}
          />
          <Button
            variant="outline"
            label="+ Add certification"
            onPress={addCertification}
            loading={busy}
            disabled={!certName.trim()}
          />

          <Input
            label="Hourly rate (optional)"
            placeholder="$ / hr"
            keyboardType="decimal-pad"
            value={hourlyRate}
            onChangeText={setHourlyRate}
            helper="Shown only to employers"
            containerStyle={{ marginTop: spacing.lg }}
          />
        </View>

        <Button
          label="Save & continue"
          onPress={onSave}
          loading={busy}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  title: { ...typography.h2, color: colors.primaryDark, marginBottom: spacing.xs },
  subtitle: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.lg },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  certNumber: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
