import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, BadgeCheck, Building2, ChevronRight, Plus, Shield } from 'lucide-react-native';
import { Badge, Button, Card, Input } from '../../src/components/ui.js';
import { VerifiedBadge } from '../../src/components/verified-badge.js';
import { ApiError, me, type LicenseRecord, type MeResponse, type WorkplaceRecord } from '../../src/lib/api.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
] as const;

type Section = 'overview' | 'add-license' | 'add-workplace';

export default function Verifications() {
  const router = useRouter();
  const [data, setData] = useState<MeResponse | null>(null);
  const [section, setSection] = useState<Section>('overview');
  const [busy, setBusy] = useState(false);

  // License form
  const [licType, setLicType] = useState('');
  const [licNumber, setLicNumber] = useState('');
  const [licState, setLicState] = useState('');

  // Workplace form
  const [wpCompany, setWpCompany] = useState('');
  const [wpRole, setWpRole] = useState('');
  const [wpEmail, setWpEmail] = useState('');
  const [wpCurrent, setWpCurrent] = useState(true);

  const load = useCallback(() => {
    me.get().then(setData).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetLicenseForm = () => {
    setLicType('');
    setLicNumber('');
    setLicState('');
  };

  const resetWorkplaceForm = () => {
    setWpCompany('');
    setWpRole('');
    setWpEmail('');
    setWpCurrent(true);
  };

  const submitLicense = async () => {
    if (!licType.trim() || !licNumber.trim() || !licState.trim()) {
      Alert.alert('Missing fields', 'Please fill in license type, number, and state.');
      return;
    }
    const stateUpper = licState.trim().toUpperCase();
    if (!US_STATES.includes(stateUpper as typeof US_STATES[number])) {
      Alert.alert('Invalid state', 'Enter a valid 2-letter US state abbreviation.');
      return;
    }
    setBusy(true);
    try {
      await me.addLicense({
        type: licType.trim(),
        number: licNumber.trim(),
        issuingState: stateUpper,
      });
      resetLicenseForm();
      load();
      setSection('overview');
      Alert.alert('License submitted', 'We\'ll verify it — this usually takes 1–3 business days.');
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Could not submit license');
    } finally {
      setBusy(false);
    }
  };

  const submitWorkplace = async () => {
    if (!wpCompany.trim() || !wpRole.trim()) {
      Alert.alert('Missing fields', 'Company name and role are required.');
      return;
    }
    setBusy(true);
    try {
      await me.addWorkplace({
        companyName: wpCompany.trim(),
        role: wpRole.trim(),
        current: wpCurrent,
        verificationEmail: wpEmail.trim() || null,
      });
      resetWorkplaceForm();
      load();
      setSection('overview');
      if (wpEmail.trim()) {
        Alert.alert('Verification sent', 'A verification email has been sent to your employer.');
      } else {
        Alert.alert('Workplace added', 'You can add a verification email later.');
      }
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Could not submit workplace');
    } finally {
      setBusy(false);
    }
  };

  const licenses: LicenseRecord[] = data?.licenses ?? [];
  const workplaces: WorkplaceRecord[] = data?.workPlaces ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (section !== 'overview') {
              setSection('overview');
            } else {
              router.back();
            }
          }}
          style={styles.backBtn}
        >
          <ArrowLeft color={colors.navy} size={22} strokeWidth={2} />
        </Pressable>
        <Text style={styles.topBarTitle}>
          {section === 'add-license' ? 'Add License' : section === 'add-workplace' ? 'Verify Workplace' : 'Verifications'}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {section === 'overview' ? (
            <OverviewSection
              licenses={licenses}
              workplaces={workplaces}
              onAddLicense={() => setSection('add-license')}
              onAddWorkplace={() => setSection('add-workplace')}
            />
          ) : null}

          {section === 'add-license' ? (
            <View>
              <Text style={styles.sectionDescription}>
                Enter your license details below. We verify licenses with state licensing boards
                in IL, CA, NY, and TX automatically. Other states are reviewed manually.
              </Text>
              <Input
                label="License type"
                placeholder="e.g. General Contractor, Electrician"
                value={licType}
                onChangeText={setLicType}
                autoCapitalize="words"
              />
              <Input
                label="License number"
                placeholder="e.g. ABC-12345"
                value={licNumber}
                onChangeText={setLicNumber}
                autoCapitalize="characters"
              />
              <Input
                label="Issuing state"
                placeholder="e.g. IL"
                value={licState}
                onChangeText={setLicState}
                maxLength={2}
                autoCapitalize="characters"
              />
              <Button
                label={busy ? 'Submitting…' : 'Submit for verification'}
                loading={busy}
                onPress={submitLicense}
                style={styles.submitBtn}
              />
            </View>
          ) : null}

          {section === 'add-workplace' ? (
            <View>
              <Text style={styles.sectionDescription}>
                Add a workplace to your profile. If you provide a company email, we'll
                send a verification request on your behalf.
              </Text>
              <Input
                label="Company name"
                placeholder="e.g. Turner Construction"
                value={wpCompany}
                onChangeText={setWpCompany}
                autoCapitalize="words"
              />
              <Input
                label="Your role"
                placeholder="e.g. Foreman, Journeyman Electrician"
                value={wpRole}
                onChangeText={setWpRole}
                autoCapitalize="words"
              />
              <Input
                label="Employer verification email (optional)"
                placeholder="hr@company.com"
                value={wpEmail}
                onChangeText={setWpEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                helper="We'll email them to confirm your employment"
              />
              <Pressable
                style={styles.checkRow}
                onPress={() => setWpCurrent(!wpCurrent)}
              >
                <View style={[styles.checkbox, wpCurrent && styles.checkboxActive]}>
                  {wpCurrent ? <BadgeCheck color={colors.textInverse} size={14} strokeWidth={2.5} /> : null}
                </View>
                <Text style={styles.checkLabel}>I currently work here</Text>
              </Pressable>
              <Button
                label={busy ? 'Submitting…' : 'Add workplace'}
                loading={busy}
                onPress={submitWorkplace}
                style={styles.submitBtn}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function OverviewSection({
  licenses,
  workplaces,
  onAddLicense,
  onAddWorkplace,
}: {
  licenses: LicenseRecord[];
  workplaces: WorkplaceRecord[];
  onAddLicense: () => void;
  onAddWorkplace: () => void;
}) {
  return (
    <View>
      <Card>
        <View style={styles.sectionHeader}>
          <Shield color={colors.navy} size={20} strokeWidth={2} />
          <Text style={styles.sectionTitle}>Licenses</Text>
        </View>
        {licenses.length === 0 ? (
          <Text style={styles.emptyText}>
            Add a license to get a verified badge on your profile.
          </Text>
        ) : (
          licenses.map((lic) => (
            <View key={lic.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={typography.bodyBold}>{lic.type}</Text>
                <Text style={styles.muted}>#{lic.number} · {lic.issuingState}</Text>
              </View>
              {lic.status === 'verified' ? (
                <VerifiedBadge size="mini" />
              ) : (
                <Badge
                  label={lic.status === 'pending' ? 'Pending' : lic.status}
                  tone={lic.status === 'rejected' ? 'danger' : 'neutral'}
                />
              )}
            </View>
          ))
        )}
        <Pressable style={styles.addRow} onPress={onAddLicense}>
          <Plus color={colors.orange} size={18} strokeWidth={2} />
          <Text style={styles.addLabel}>Add a license</Text>
          <ChevronRight color={colors.textMuted} size={16} strokeWidth={2} />
        </Pressable>
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Building2 color={colors.navy} size={20} strokeWidth={2} />
          <Text style={styles.sectionTitle}>Workplaces</Text>
        </View>
        {workplaces.length === 0 ? (
          <Text style={styles.emptyText}>
            Verify your workplace to strengthen your profile.
          </Text>
        ) : (
          workplaces.map((wp) => (
            <View key={wp.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={typography.bodyBold}>{wp.companyName}</Text>
                <Text style={styles.muted}>{wp.role}{wp.current ? ' · Current' : ''}</Text>
              </View>
              {wp.status === 'verified' ? (
                <VerifiedBadge size="mini" />
              ) : (
                <Badge
                  label={wp.status === 'pending' ? 'Pending' : wp.status}
                  tone={wp.status === 'rejected' ? 'danger' : 'neutral'}
                />
              )}
            </View>
          ))
        )}
        <Pressable style={styles.addRow} onPress={onAddWorkplace}>
          <Plus color={colors.orange} size={18} strokeWidth={2} />
          <Text style={styles.addLabel}>Add a workplace</Text>
          <ChevronRight color={colors.textMuted} size={16} strokeWidth={2} />
        </Pressable>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { ...typography.h3, color: colors.navy },
  content: { padding: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.h3, color: colors.navy },
  sectionDescription: {
    ...typography.body,
    color: colors.textBody,
    marginBottom: spacing.lg,
  },
  emptyText: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  muted: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginTop: spacing.sm,
  },
  addLabel: { ...typography.bodyBold, color: colors.navy, flex: 1 },
  submitBtn: { marginTop: spacing.lg },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.orange,
    borderColor: colors.orange,
  },
  checkLabel: { ...typography.body, color: colors.textPrimary },
});
