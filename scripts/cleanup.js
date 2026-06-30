const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

const serviceAccountPath = path.resolve(__dirname, "../service-account.json");
const serviceAccount = require(serviceAccountPath);

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

async function cleanup() {
  console.log("Looking for old manually created issues...");
  
  const snap = await db.collection("issues").get();
  
  const batch = db.batch();
  let deleteCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    // Delete issues that don't have the city field (which means they were manually reported before seeding)
    // Or if they explicitly have 'city: "Hyderabad"' but were created a long time ago (we'll just use the reporterName flag to be safe)
    if (!data.city || data.reporterName !== "Citizen Reporter") {
      batch.delete(doc.ref);
      deleteCount++;
    }
  }

  if (deleteCount > 0) {
    await batch.commit();
    console.log(`✅ Deleted ${deleteCount} old/manual issues.`);
  } else {
    console.log("No old issues found to delete.");
  }
}

cleanup().catch(console.error);
