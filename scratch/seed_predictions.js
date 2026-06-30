const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, GeoPoint, FieldValue } = require('firebase-admin/firestore');
const serviceAccount = require('../service-account.json');

// Initialize only if not already initialized
try {
  initializeApp({
    credential: cert(serviceAccount)
  });
} catch(e) {}

const db = getFirestore();

async function seedPredictions() {
  console.log("Seeding predictions...");
  
  const predictions = [
    {
      id: "pred_1",
      location: new GeoPoint(17.4265, 78.4010),
      wardId: "ward_1",
      ward: "Jubilee Hills",
      reasoning: "Recurring water pooling near road base suggests high probability of subsurface pipe fracture. Expected surface collapse within 14 days if unmitigated.",
      status: "active",
      confidence: 87,
      createdAt: FieldValue.serverTimestamp(),
    },
    {
      id: "pred_2",
      location: new GeoPoint(17.4320, 78.4110),
      wardId: "ward_2",
      ward: "Banjara Hills",
      reasoning: "Multiple adjacent streetlight outages reported over 48 hours. Pattern indicates localized transformer failure rather than isolated bulb burnouts.",
      status: "active",
      confidence: 92,
      createdAt: FieldValue.serverTimestamp(),
    },
    {
      id: "pred_3",
      location: new GeoPoint(17.4190, 78.4050),
      wardId: "ward_1",
      ward: "Jubilee Hills",
      reasoning: "High cluster of waste accumulation reports intersecting with upcoming monsoon drains. Critical flood risk identified for this junction.",
      status: "active",
      confidence: 78,
      createdAt: FieldValue.serverTimestamp(),
    }
  ];

  for (const p of predictions) {
    await db.collection("predictions").doc(p.id).set(p);
    console.log(`Seeded prediction: ${p.id}`);
  }
  
  console.log("Done.");
  process.exit(0);
}

seedPredictions().catch(console.error);
