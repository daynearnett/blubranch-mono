import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../src/lib/auth-context.js';
import { colors } from '../src/theme.js';

export default function Index() {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return <Redirect href={status === 'signed-in' ? '/(app)/(tabs)/feed' : '/(auth)/welcome'} />;
}
