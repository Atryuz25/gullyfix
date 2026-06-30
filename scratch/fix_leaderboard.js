const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const serviceAccount = require('../service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function fixLeaderboard() {
  console.log("Fetching profiles...");
  const snap = await db.collection("public_profiles").get();
  let count = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const reportsCount = data.reportsCount || 0;
    const verifyCount = data.verifyCount || 0;
    
    // Formula: 50 XP per report, 10 XP per verify
    const expectedXp = (reportsCount * 50) + (verifyCount * 10);
    
    if (data.xpPoints !== expectedXp) {
      console.log(`Fixing ${data.displayName}: ${data.xpPoints} -> ${expectedXp}`);
      await doc.ref.update({ xpPoints: expectedXp });
      count++;
    }
  }
  console.log(`Fixed ${count} profiles.`);
  process.exit(0);
}

fixLeaderboard().catch(console.error);
