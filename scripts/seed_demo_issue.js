const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const fs = require('fs');

const path = require('path');

const serviceAccountPath = path.resolve(__dirname, "../service-account.json");
const serviceAccount = require(serviceAccountPath);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const issueId = 'demo-issue-perfect';

  // Seed the specific Ward if it doesn't exist just in case
  await db.collection('wards').doc('ward_kurla').set({
    ward: 'Kurla',
    city: 'Mumbai',
    healthScore: 42,
    urgencyLevel: 'critical',
    avgResolutionDays: 14.5
  }, { merge: true });

  // Seed the Department to ensure it's blacklisted
  await db.collection('departments').doc('mcgm_roads').set({
    name: 'MCGM Roads',
    city: 'Mumbai',
    reputationScore: 34,
    ghostResolutionCount: 3,
    slaBreachCount: 14,
    totalResolved: 82,
    blacklisted: true,
    blacklistedUntil: Timestamp.fromDate(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)),
    lastUpdated: Timestamp.now()
  });

  console.log("Department MCGM Roads blacklisted seeded.");

  // Insert the Perfect Demo Issue
  const issueData = {
    userId: 'demo-judge',
    category: 'road_damage',
    ward: 'Kurla',
    wardId: 'ward_kurla',
    city: 'Mumbai',
    lat: 19.0728, // Near KEM Hospital roughly
    lng: 72.8826,
    address: 'Near KEM Hospital, Kurla, Mumbai',
    status: 'disputed',
    priorityScore: 94,
    basePriority: 62,
    equityTier: 3,
    equityLabel: 'Underserved ward',
    equityMultiplier: 1.35,
    corridorDetected: true,
    corridorPlaceName: 'KEM Hospital',
    corridorDistanceMeters: 67,
    photoURL: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=600&auto=format&fit=crop',
    resolutionPhotoUrl: 'https://images.unsplash.com/photo-1616886985732-c11c1dfb7da8?q=80&w=600&auto=format&fit=crop', // completely different generic road
    disputePhotoUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=600&auto=format&fit=crop', // same as original
    persistenceConfirmed: true,
    disputeReasoning: 'Original crack pattern and surface depression clearly visible in dispute photo. Resolution photo shows adjacent area, not the reported hazard location.',
    department: 'MCGM Roads',
    departmentReputationImpact: -12,
    departmentNewScore: 34,
    departmentBlacklisted: true,
    aiReasoning: 'The uploaded image reveals a severe depression in the asphalt with exposed sub-base, indicating structural failure. This pothole poses a high risk to two-wheelers and could cause vehicular damage. Given the 67m proximity to KEM Hospital, emergency vehicle routing is directly impacted, necessitating immediate intervention. The citizen originally reported unspecified, but visual evidence strongly confirms road_damage.',
    aiConfidence: 0.98,
    escalationLevel: 2,
    slaBreached: true,
    slaDeadline: Timestamp.fromDate(new Date(Date.now() - 48 * 60 * 60 * 1000)), // 2 days ago
    quarantineFlags: 2,
    quarantineStatus: 'cleared',
    verifyCount: 4,
    disputeCount: 1,
    createdAt: Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)), // 7 days ago
    updatedAt: Timestamp.now()
  };

  await db.collection('issues').doc(issueId).set(issueData);
  console.log("Perfect demo issue inserted as 'demo-issue-perfect'.");
}

run().then(() => {
  console.log("Seed complete.");
  process.exit(0);
}).catch(console.error);
