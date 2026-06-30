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

const WARDS = [
  { id: "ward_1", name: "Jubilee Hills", lat: 17.4239, lng: 78.4062 },
  { id: "ward_2", name: "Banjara Hills", lat: 17.4168, lng: 78.4385 },
  { id: "ward_3", name: "HITEC City", lat: 17.4435, lng: 78.3772 },
  { id: "ward_4", name: "Gachibowli", lat: 17.4401, lng: 78.3489 },
  { id: "ward_5", name: "Madhapur", lat: 17.4483, lng: 78.3915 }
];

const CATEGORIES = ["road_damage", "water_leakage", "streetlight", "waste"];
const DEPARTMENTS = ["Roads & Infrastructure Dept.", "Water Supply & Drainage Dept.", "Solid Waste Management Dept.", "Street Lighting Dept."];
const DEFAULT_PHOTO = "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&q=80&w=800";
const RESOLVE_PHOTO = "https://images.unsplash.com/photo-1605383562694-8845bc88e146?auto=format&fit=crop&q=80&w=800"; // Repaired road

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomOffset() {
  return (Math.random() - 0.5) * 0.02; // Roughly +/- 1km
}

async function seedIssues() {
  console.log("Fetching a real user UID for demo...");
  const profilesSnap = await db.collection("public_profiles").limit(1).get();
  const demoUserId = profilesSnap.empty ? "u1" : profilesSnap.docs[0].id;
  const demoUserName = profilesSnap.empty ? "Demo User" : profilesSnap.docs[0].data().displayName;

  console.log(`Using UID ${demoUserId} (${demoUserName}) for demo issues.`);
  console.log("Seeding 50 realistic issues...");
  let count = 0;

  for (let i = 0; i < 50; i++) {
    const ward = WARDS[randomInt(0, WARDS.length - 1)];
    const catIdx = randomInt(0, CATEGORIES.length - 1);
    
    // We want 3 specific issues to be pending_verification for demo
    let status = "open";
    let resolutionPhotoUrl = null;
    let reportedBy = "u1"; // Using standard user ID if present, else just string

    if (i < 3) {
      status = "pending_verification";
      resolutionPhotoUrl = RESOLVE_PHOTO;
      // We assume user with uid 'u1' or whatever auth you login with.
      // To ensure you can test it, we'll set reportedBy to the actual current user if known, 
      // but 'u1' or leaving it to a specific known ID might be required.
      // We will set reportedBy to "TEST_USER_ID" and update it if needed.
    } else if (i < 15) {
      status = "in_progress";
    } else if (i < 25) {
      status = "resolved";
      resolutionPhotoUrl = RESOLVE_PHOTO;
    }

    const docRef = db.collection("issues").doc();
    await docRef.set({
      category: CATEGORIES[catIdx],
      department: DEPARTMENTS[catIdx],
      status: status,
      priorityScore: randomInt(30, 95),
      location: new GeoPoint(ward.lat + randomOffset(), ward.lng + randomOffset()),
      ward: ward.name,
      wardId: ward.id,
      description: `Realistic issue reported in ${ward.name} regarding ${CATEGORIES[catIdx].replace("_", " ")}.`,
      photoURL: DEFAULT_PHOTO,
      resolutionPhotoUrl: resolutionPhotoUrl,
      reportedBy: i < 3 ? demoUserId : `citizen_${i}`, 
      reporterName: i < 3 ? demoUserName : `Citizen ${i}`,
      aiReasoning: `[AI] Classified as ${CATEGORIES[catIdx]} with Priority ${randomInt(30, 95)}.`,
      createdAt: FieldValue.serverTimestamp(),
      verifyCount: randomInt(0, 10),
      slaBreached: i > 45,
      disputeCount: 0,
      slaDeadline: new Date(Date.now() + randomInt(-2, 5) * 86400000)
    });

    count++;
  }
  console.log(`Seeded ${count} issues successfully.`);
  process.exit(0);
}

seedIssues().catch(console.error);
