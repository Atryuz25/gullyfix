const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, GeoPoint } = require('firebase-admin/firestore');

// Load service account (ensure service-account.json is in root)
const serviceAccount = require('../service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const predictionsData = [
  {
    wardId: "w1",
    ward: "Jubilee Hills",
    zone: "Sector 4",
    category: "water_leakage",
    probability: 0.89,
    confidenceLabel: "89% Probability",
    reasoning: "Predicted failure based on: 1. Historical 6-month drainage failure frequency in this sector. 2. Current season-specific monsoon risk. 3. Lack of maintenance reports in last 12 months.",
    basedOnIssueCount: 14,
    timeWindowDays: 14,
    location: new GeoPoint(17.4339, 78.4062),
    generatedAt: new Date(),
    status: "active"
  },
  {
    wardId: "w1",
    ward: "Jubilee Hills",
    zone: "Sector 2",
    category: "road_damage",
    probability: 0.94,
    confidenceLabel: "94% Probability",
    reasoning: "Predicted failure based on: 1. High traffic volume anomaly detected in past 72 hours. 2. Sub-surface moisture levels from recent sensor data. 3. Age of asphalt layer exceeds 5 years.",
    basedOnIssueCount: 22,
    timeWindowDays: 7,
    location: new GeoPoint(17.4139, 78.4162),
    generatedAt: new Date(),
    status: "active"
  },
  {
    wardId: "w1",
    ward: "Jubilee Hills",
    zone: "Sector 7",
    category: "streetlight",
    probability: 0.72,
    confidenceLabel: "72% Probability",
    reasoning: "Predicted failure based on: 1. Cascade failure pattern detected in adjacent street grid. 2. Transformer age exceeding optimal operational window. 3. 4 resolved reports in 30 days.",
    basedOnIssueCount: 8,
    timeWindowDays: 30,
    location: new GeoPoint(17.4289, 78.3962),
    generatedAt: new Date(),
    status: "active"
  }
];

async function seedPredictions() {
  console.log("Seeding predictions...");
  let count = 0;
  for (const p of predictionsData) {
    await db.collection("predictions").add(p);
    count++;
  }
  console.log(`Successfully seeded ${count} predictions!`);
}

seedPredictions().catch(console.error);
