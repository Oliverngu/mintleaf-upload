// To run this script:
// 1. Make sure you have `firebase-admin` installed (`npm install firebase-admin`).
// 2. Set up Google Application Default Credentials: `gcloud auth application-default login --project=mintleaf-74d27`.
// 3. Run `node scripts/seedEmailConfig.mjs`.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// If using Application Default Credentials, you can just call initializeApp()
try {
  initializeApp({
    projectId: 'mintleaf-74d27',
  });
} catch (e) {
  console.log("Firebase app already initialized or ADC not configured.");
}

const db = getFirestore();

const SERVICES = ['system', 'bookings', 'leaves', 'polls'];
const DEFAULT_FROM = "MintLeaf <noreply@mintleaf.hu>";

async function seedDatabase() {
  console.log('Starting Firestore seeding for email configuration...');

  const batch = db.batch();

  // 1. Set the global feature flag
  const flagRef = db.collection('appFlags').doc('email');
  batch.set(flagRef, {
    writeEnabled: false,
    description: "Controls whether admins can save email configs and send real test emails. Set to true to enable."
  }, { merge: true });
  console.log('-> Scheduled write for appFlags/email');

  // 2. Set default config for each service
  for (const serviceId of SERVICES) {
    const configRef = db.collection('emailConfigs').doc(serviceId);
    const defaultConfig = {
      enabled: true,
      fromAddress: DEFAULT_FROM,
      replyTo: "",
      bcc: [],
      subjectTemplates: {},
      bodyTemplates: {},
    };
    batch.set(configRef, defaultConfig, { merge: true });
    console.log(`-> Scheduled write for emailConfigs/${serviceId}`);
  }

  try {
    await batch.commit();
    console.log('\n✅ Firestore seeding completed successfully!');
    console.log('The Email Admin page is now in read-only mode.');
    console.log('To enable saving, set `writeEnabled` to `true` in the `appFlags/email` document.');
  } catch (error) {
    console.error('❌ Error committing batch:', error);
  }
}

seedDatabase();
