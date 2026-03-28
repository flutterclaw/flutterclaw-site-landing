/**
 * Export Google Play closed-beta sign-ups from Firestore to a CSV for Play Console
 * (e.g. import testers). Collection: playClosedBetaSignups; fields: email, createdAt.
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
 * Output: play-closed-beta-emails.csv — columns Email, CreatedAt (ISO 8601 UTC).
 * Rows are sorted by CreatedAt (oldest first); legacy docs without createdAt sort last.
 * For Play Console import (email only), use the first column or delete CreatedAt in a copy.
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

function createdAtToIso(ts) {
  if (ts && typeof ts.toDate === 'function') {
    return ts.toDate().toISOString();
  }
  return '';
}

const snap = await db.collection(COLLECTION).get();
const rows = snap.docs
  .map((d) => {
    const data = d.data();
    const email = data.email;
    if (typeof email !== 'string' || !email.includes('@')) return null;
    const createdAt = data.createdAt;
    const createdAtIso = createdAtToIso(createdAt);
    const sortMs =
      createdAt && typeof createdAt.toDate === 'function'
        ? createdAt.toDate().getTime()
        : Number.POSITIVE_INFINITY;
    return { email, createdAtIso, sortMs };
  })
  .filter(Boolean);

rows.sort((a, b) => {
  if (a.sortMs !== b.sortMs) return a.sortMs - b.sortMs;
  return a.email.localeCompare(b.email);
});

const header = ['Email', 'CreatedAt'].map(csvEscape).join(',');
const body = rows.map((r) =>
  [csvEscape(r.email), csvEscape(r.createdAtIso)].join(',')
);
const csv = [header, ...body].join('\n') + '\n';
const outPath = resolve(process.cwd(), OUT_FILE);
writeFileSync(outPath, csv, 'utf8');
console.log(`Wrote ${rows.length} row(s) to ${outPath}`);
