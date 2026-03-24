/**
 * Export Google Play closed-beta sign-ups from Firestore to a CSV for Play Console
 * (e.g. import testers). Collection: playClosedBetaSignups, field: email.
 *
 * Setup (one-time):
 * 1. Enable Firestore in the Firebase / Google Cloud project (flutterclaw-c226e).
 * 2. Deploy firestore.rules (public create only on playClosedBetaSignups; no public reads):
 *      firebase deploy --only firestore:rules
 *    (Install Firebase CLI if needed: https://firebase.google.com/docs/cli)
 * 3. Google Cloud Console → IAM & Admin → Service Accounts → create a key (JSON).
 *    Use a role that can read Firestore, e.g. "Cloud Datastore User", or a custom role
 *    with datastore.entities.get/list on the project. Do not commit the JSON file.
 *
 * Run from repository root:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
 *   npm install
 *   npm run export-play-beta
 *
 * Output: play-closed-beta-emails.csv (header "Email", then unique addresses sorted).
 * If Play expects no header or a different column name, edit the file before import.
 */

import admin from 'firebase-admin';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ID = 'flutterclaw-c226e';
const COLLECTION = 'playClosedBetaSignups';
const OUT_FILE = 'play-closed-beta-emails.csv';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    'Set GOOGLE_APPLICATION_CREDENTIALS to the absolute path of your service account JSON file.'
  );
  process.exit(1);
}

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

function csvEscape(cell) {
  const s = String(cell);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const snap = await db.collection(COLLECTION).get();
const emails = [
  ...new Set(
    snap.docs
      .map((d) => d.data().email)
      .filter((e) => typeof e === 'string' && e.includes('@'))
  ),
].sort((a, b) => a.localeCompare(b));

const lines = ['Email', ...emails.map(csvEscape)];
const csv = lines.join('\n') + '\n';
const outPath = resolve(process.cwd(), OUT_FILE);
writeFileSync(outPath, csv, 'utf8');
console.log(`Wrote ${emails.length} unique email(s) to ${outPath}`);
