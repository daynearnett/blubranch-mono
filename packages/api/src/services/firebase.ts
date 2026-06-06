import admin from 'firebase-admin';

let initialized = false;

/**
 * Initialize Firebase Admin SDK. Called lazily on first push attempt.
 *
 * Configuration options (checked in order):
 * 1. FIREBASE_SERVICE_ACCOUNT_JSON env var — stringified JSON of a
 *    service account key. This is the recommended approach for Railway.
 * 2. GOOGLE_APPLICATION_CREDENTIALS env var — path to a service account
 *    JSON file on disk. Standard GCP convention.
 * 3. Application Default Credentials — works automatically on GCP/Firebase
 *    hosting or when `gcloud auth` is configured.
 *
 * If none are available, Firebase will not initialize and push
 * notifications will be silently skipped.
 */
export function initFirebase(): boolean {
  if (initialized) return true;

  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const projectId = process.env.FIREBASE_PROJECT_ID;

    if (serviceAccountJson && serviceAccountJson !== '{}') {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId || serviceAccount.project_id,
      });
      initialized = true;
      console.log('[Firebase] Initialized with service account');
      return true;
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({ projectId });
      initialized = true;
      console.log('[Firebase] Initialized with application default credentials');
      return true;
    }

    console.warn(
      '[Firebase] No credentials configured — push notifications disabled. ' +
        'Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.',
    );
    return false;
  } catch (err) {
    console.error('[Firebase] Initialization failed:', err);
    return false;
  }
}

/**
 * Get the Firebase Messaging instance. Returns null if Firebase
 * is not initialized.
 */
export function getMessaging(): admin.messaging.Messaging | null {
  if (!initialized && !initFirebase()) return null;
  return admin.messaging();
}
