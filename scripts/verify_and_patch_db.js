const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccountPath = path.resolve(__dirname, "../service-account.json");
const serviceAccount = require(serviceAccountPath);

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

async function run() {
  console.log("Verifying Database for Checklist...");

  // 1. Check Ghost Resolutions and SLA breaches
  const issuesSnap = await db.collection("issues").get();
  let ghostResolutions = 0;
  let slaBreaches = 0;
  let disputedFull = 0; // disputed with all 3 photos

  issuesSnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.status === "disputed") {
      ghostResolutions++;
      if (data.photoURL && data.resolutionPhotoUrl && data.disputePhotoUrl) {
        disputedFull++;
      }
    }
    if (data.slaBreached) slaBreaches++;
  });

  console.log(`Ghost Resolutions: ${ghostResolutions} (Need 8+)`);
  console.log(`Disputed with 3 photos: ${disputedFull} (Need 10+)`);
  console.log(`SLA Breaches: ${slaBreaches} (Need 10+)`);

  // Fix if needed
  if (disputedFull < 10) {
    const toUpdate = 10 - disputedFull;
    let updated = 0;
    for (const doc of issuesSnap.docs) {
      if (updated >= toUpdate) break;
      const data = doc.data();
      if (data.status === "resolved" || data.status === "open") {
        await db.collection("issues").doc(doc.id).update({
          status: "disputed",
          photoURL: "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80",
          resolutionPhotoUrl: "https://images.unsplash.com/photo-1616886985732-c11c1dfb7da8?q=80",
          disputePhotoUrl: "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80",
          slaBreached: true
        });
        updated++;
      }
    }
    console.log(`Patched ${updated} issues to disputed with 3 photos & SLA breach`);
  }

  // 2. Check Users
  const usersSnap = await db.collection("public_profiles").get();
  console.log(`Total Users: ${usersSnap.size} (Need 8+)`);

  if (usersSnap.size < 8) {
    console.log("Patching missing users...");
    const needed = 8 - usersSnap.size;
    for (let i = 0; i < needed; i++) {
      const uId = `demo-user-${i}`;
      await db.collection("public_profiles").doc(uId).set({
        displayName: `Citizen ${i}`,
        city: "Mumbai",
        wardName: "Kurla",
        xpPoints: 100 + (i * 20),
        reportCount: 5 + i,
        verifyCount: 10 + i,
        joinedAt: Timestamp.now()
      });
    }
    console.log(`Added ${needed} demo users.`);
  }

  // 3. Departments
  const deptsSnap = await db.collection("departments").get();
  let below60 = 0;
  deptsSnap.docs.forEach(doc => {
    if (doc.data().reputationScore < 60) below60++;
  });
  console.log(`Depts below 60: ${below60} (Need 2+)`);

  if (below60 < 2) {
    console.log("Patching departments to have scores < 60");
    const toPatch = 2 - below60;
    let patched = 0;
    for (const doc of deptsSnap.docs) {
      if (patched >= toPatch) break;
      if (doc.data().reputationScore >= 60 && doc.id !== 'mcgm_roads') {
        await db.collection("departments").doc(doc.id).update({
          reputationScore: 55,
          ghostResolutionCount: 8
        });
        patched++;
      }
    }
  }

  console.log("Verification script complete!");
}

run().then(() => process.exit(0)).catch(console.error);
