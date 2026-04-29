// Post tab — branches by role:
//   • employer → starts the 6-step posting wizard (Mockup 7A→7F)
//   • worker   → placeholder until the post-composer ships in Phase 4
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Placeholder } from '../../../src/components/placeholder.js';
import { useAuth } from '../../../src/lib/auth-context.js';

export default function PostTab() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role === 'employer' || user?.role === 'admin') {
      router.replace('/(app)/post-job/plan');
    }
  }, [user, router]);

  // Workers and unauthed users get the same placeholder for now.
  return (
    <Placeholder
      icon="📸"
      title="Create a post"
      comingIn="Coming in Phase 4"
      body="Workers' post composer ships next. Employers — tap Post to start a job listing."
    />
  );
}
