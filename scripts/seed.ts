/**
 * GullyFix Seed Script
 * Run: npx ts-node --esm scripts/seed.ts
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS set to a service account JSON
 * with Firestore write access.
 *
 * Seeds:
 *  - 50 issues across 5 Hyderabad wards
 *  - 4 issues tightly clustered at Town Hall (for duplicate detection demo)
 *  - 30 resolved issues with historical timestamps
 *  - 15 prediction records (3 per ward)
 *  - 4 citizen public_profiles + users records
 *  - 1 admin user record
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, GeoPoint, Timestamp } from "firebase-admin/firestore";
import * as path from "path";

// ─── Init ─────────────────────────────────────────────────────────────────────

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account.json";

initializeApp({
  credential: cert(path.resolve(credPath)),
});

const db = getFirestore();

// ─── Ward Definitions (Hyderabad) ───────────────────────────────────────────

const WARDS = [
  {
    wardId: "ward_1",
    ward: "Ward 1 — Jubilee Hills",
    center: { lat: 17.4326, lng: 78.4071 },
  },
  {
    wardId: "ward_2",
    ward: "Ward 2 — Banjara Hills",
    center: { lat: 17.4156, lng: 78.4347 },
  },
  {
    wardId: "ward_3",
    ward: "Ward 3 — HITEC City",
    center: { lat: 17.4435, lng: 78.3772 },
  },
  {
    wardId: "ward_4",
    ward: "Ward 4 — Gachibowli",
    center: { lat: 17.4401, lng: 78.3489 },
  },
  {
    wardId: "ward_5",
    ward: "Ward 5 — Madhapur",
    center: { lat: 17.4483, lng: 78.3915 },
  },
];

// ─── Town Hall cluster coordinate (for async duplicate detection demo) ────────
// 4 issues seeded here so Gemini's "Checking nearby reports" always triggers.
const TOWN_HALL = { lat: 17.4300, lng: 78.4060 }; // Jubilee Hills Checkpost

// ─── Category definitions ─────────────────────────────────────────────────────

type Category = "road_damage" | "water_leakage" | "waste" | "streetlight";

const CATEGORY_MAP: Record<
  Category,
  { department: string; descriptions: string[]; addresses: string[] }
> = {
  road_damage: {
    department: "Roads & Infrastructure Dept.",
    descriptions: [
      "Large pothole spanning nearly half the lane width causing vehicles to swerve dangerously.",
      "Road surface has cracked and sunken near the storm drain, creating a hazard for two-wheelers.",
      "Severe road damage after recent rain — deep trench visible near the main junction.",
      "Broken road divider and surface degradation near the bus stop.",
      "Asphalt completely worn off, exposing gravel and posing risk to pedestrians.",
    ],
    addresses: [
      "Road No. 36, Jubilee Hills",
      "Road No. 1, Banjara Hills",
      "Mindspace Junction, HITEC City",
      "ISB Road, Gachibowli",
      "100 Feet Road, Madhapur",
    ],
  },
  water_leakage: {
    department: "Water Supply & Drainage Dept.",
    descriptions: [
      "Water main burst near the footpath — water flowing onto road for past 12 hours.",
      "Underground pipe leaking visible from surface crack — water logged area near apartments.",
      "Sewage overflow from blocked drain causing foul smell and health hazard.",
      "Water leaking from municipal supply line near school gate.",
      "Drainage pipe damaged, water pooling on road surface since yesterday.",
    ],
    addresses: [
      "Road No. 45, Jubilee Hills",
      "KBR Park Road, Banjara Hills",
      "Cyber Towers Junction, HITEC City",
      "DLF Cyber City, Gachibowli",
      "Inorbit Mall Road, Madhapur",
    ],
  },
  waste: {
    department: "Solid Waste Management Dept.",
    descriptions: [
      "Garbage dumped on roadside, collection missed for 3 days — foul smell and flies.",
      "Overflowing municipal bin attracting stray animals, needs urgent clearing.",
      "Construction waste dumped illegally on the footpath blocking pedestrian access.",
      "Waste from nearby market not collected — spilling onto road.",
      "Plastic waste accumulated near canal, risk of flooding if not cleared.",
    ],
    addresses: [
      "Jubilee Hills Checkpost",
      "Road No. 12, Banjara Hills",
      "Durgam Cheruvu Road, HITEC City",
      "Bio-Diversity Junction, Gachibowli",
      "Ayyappa Society, Madhapur",
    ],
  },
  streetlight: {
    department: "Street Lighting Dept.",
    descriptions: [
      "Streetlight pole near the junction is not working — complete darkness at night.",
      "Three consecutive streetlights on this stretch are out since two days.",
      "Light flickers and goes off — electrical fault suspected at the base.",
      "Streetlight damaged after vehicle collision, hanging precariously.",
      "No street lighting on this stretch — residents afraid to walk at night.",
    ],
    addresses: [
      "2nd Street, Singanallur",
      "VOC Park Road",
      "Peelamedu Main Road",
      "Saibaba Colony 5th Street",
      "Airport Road, near College of Engineering",
    ],
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function jitter(center: { lat: number; lng: number }, radiusKm = 0.5) {
  // Random point within radiusKm of center
  const r = (radiusKm / 111.32) * Math.sqrt(Math.random());
  const theta = Math.random() * 2 * Math.PI;
  return {
    lat: center.lat + r * Math.cos(theta),
    lng: center.lng + r * Math.sin(theta),
  };
}

function daysAgo(days: number): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return Timestamp.fromDate(d);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Seed Issues ─────────────────────────────────────────────────────────────

async function seedIssues() {
  console.log("Seeding 50 issues across 5 wards...");

  const categoryDistribution: Category[] = [
    ...Array(20).fill("road_damage"),
    ...Array(12).fill("water_leakage"),
    ...Array(10).fill("waste"),
    ...Array(8).fill("streetlight"),
  ];

  // 30 resolved, 20 open
  const statuses = [
    ...Array(30).fill("resolved"),
    ...Array(20).fill("open"),
  ];

  const batch = db.batch();
  let count = 0;

  for (let i = 0; i < 50; i++) {
    const ward = WARDS[i % WARDS.length];
    const category = categoryDistribution[i];
    const catData = CATEGORY_MAP[category];
    const status = statuses[i];
    const coords = jitter(ward.center);
    const createdDaysAgo = randomInt(1, 180);
    const priority = randomInt(30, 95);

    const issueRef = db.collection("issues").doc();

    const issue: Record<string, unknown> = {
      id: issueRef.id,
      status,
      category,
      priorityScore: priority,
      department: catData.department,
      description: pick(catData.descriptions),
      aiReasoning: `Issue identified as ${category.replace("_", " ")} with priority ${priority}. ${
        priority > 70
          ? "High severity — safety risk to citizens."
          : "Moderate severity — routine maintenance required."
      } Routed to ${catData.department}.`,
      aiConfidence: parseFloat(randomBetween(0.72, 0.97).toFixed(2)),
      visionLabels: getVisionLabels(category),
      photoURL: getUnsplashUrl(category),
      photoAltText: `${category.replace("_", " ")} issue reported at ${pick(catData.addresses)}, Hyderabad.`,
      location: new GeoPoint(coords.lat, coords.lng),
      address: pick(catData.addresses),
      ward: ward.ward,
      wardId: ward.wardId,
      verifyCount: randomInt(0, 8),
      verifiedBy: [],
      reportedBy: pick(["citizen_raj", "priya_s", "ward3_watch", "new_reporter"]),
      reporterName: pick(["Raj Kumar", "Priya Sharma", "Ward 3 Watch", "New Reporter"]),
      mergedIntoId: null,
      createdAt: daysAgo(createdDaysAgo),
      resolvedAt: status === "resolved" ? daysAgo(createdDaysAgo - randomInt(3, 15)) : null,
    };

    batch.set(issueRef, issue);
    count++;
  }

  await batch.commit();
  console.log(`✓ Seeded ${count} issues`);
}

function getVisionLabels(category: Category): string[] {
  const labelMap: Record<Category, string[]> = {
    road_damage: ["Road", "Asphalt", "Pothole", "Infrastructure", "Damage"],
    water_leakage: ["Water", "Pipe", "Leak", "Flood", "Drainage"],
    waste: ["Garbage", "Waste", "Trash", "Pollution", "Landfill"],
    streetlight: ["Street light", "Lamp post", "Electricity", "Night", "Urban area"],
  };
  return labelMap[category];
}

function getUnsplashUrl(category: Category): string {
  const urlMap: Record<Category, string[]> = {
    road_damage: [
      "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?q=80&w=600&auto=format&fit=crop"
    ],
    water_leakage: [
      "https://images.unsplash.com/photo-1541888086826-ebdcafbc6da3?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1582269438781-30bc12f2ee96?q=80&w=600&auto=format&fit=crop"
    ],
    waste: [
      "https://images.unsplash.com/photo-1530587191325-3db32d826c18?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1605600659873-d808a1d14b48?q=80&w=600&auto=format&fit=crop"
    ],
    streetlight: [
      "https://images.unsplash.com/photo-1515523110800-9415d13b84a8?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1563207153-f404dc2b800c?q=80&w=600&auto=format&fit=crop"
    ],
  };
  return pick(urlMap[category]);
}

// ─── Seed Town Hall Cluster (for duplicate detection demo) ───────────────────

async function seedTownHallCluster() {
  console.log("Seeding Town Hall cluster (4 issues for duplicate detection demo)...");

  const batch = db.batch();

  for (let i = 0; i < 4; i++) {
    const coords = {
      lat: TOWN_HALL.lat + (Math.random() - 0.5) * 0.0005, // within ~30m
      lng: TOWN_HALL.lng + (Math.random() - 0.5) * 0.0005,
    };

    const ref = db.collection("issues").doc();
    batch.set(ref, {
      id: ref.id,
      status: i < 2 ? "open" : "resolved",
      category: "road_damage",
      priorityScore: 72 + i * 3,
      department: "Roads & Infrastructure Dept.",
      description: "Deep pothole at Town Hall junction — vehicles swerving, risk of accidents.",
      aiReasoning:
        "Large pothole detected at a high-traffic civic zone. Multiple reports confirm severity. Routed to Roads & Infrastructure Dept. for urgent repair.",
      aiConfidence: 0.91,
      visionLabels: ["Road", "Asphalt", "Pothole", "Damage"],
      photoURL: "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=600&auto=format&fit=crop",
      photoAltText: `Road damage issue reported at Jubilee Hills Checkpost, Hyderabad.`,
      location: new GeoPoint(coords.lat, coords.lng),
      address: `Jubilee Hills Checkpost, Hyderabad — ${["near Main Gate", "opposite Post Office", "near Collector's Office", "near Bus Stop"][i]}`,
      ward: "Ward 1 — Jubilee Hills",
      wardId: "ward_1",
      verifyCount: i === 0 ? 12 : i === 1 ? 12 : randomInt(2, 6),
      verifiedBy: [],
      reportedBy: "citizen_raj",
      reporterName: "Raj Kumar",
      mergedIntoId: null,
      createdAt: daysAgo(randomInt(3, 30)),
      resolvedAt: i >= 2 ? daysAgo(randomInt(1, 5)) : null,
    });
  }

  await batch.commit();
  console.log("✓ Seeded Town Hall cluster (4 issues, 2 with verifyCount=12)");
}

// ─── Seed Predictions ─────────────────────────────────────────────────────────

async function seedPredictions() {
  console.log("Seeding 15 prediction records (3 per ward)...");

  const batch = db.batch();

  const predictionTemplates = [
    {
      zone: "Zone A",
      category: "road_damage",
      probability: 0.78,
      confidenceLabel: "78% probability",
      timeWindowDays: 30,
      reasoning:
        "Historical data shows 6 road damage incidents in this zone over the past 6 months, with 3 occurring during monsoon season. Drainage infrastructure aging detected. Preventive maintenance recommended before next rainfall.",
    },
    {
      zone: "Zone B",
      category: "water_leakage",
      probability: 0.65,
      confidenceLabel: "65% probability",
      timeWindowDays: 30,
      reasoning:
        "Water supply pipe network in this zone is over 15 years old based on infrastructure records. 4 leakage incidents in past 3 months suggest systemic failure imminent. Pipe replacement survey advised.",
    },
    {
      zone: "Zone C",
      category: "streetlight",
      probability: 0.71,
      confidenceLabel: "71% probability",
      timeWindowDays: 21,
      reasoning:
        "Street lighting failure rate in this corridor has tripled in the past month. Pattern suggests electrical supply issue affecting the entire stretch rather than individual faults.",
    },
  ];

  for (const ward of WARDS) {
    for (let i = 0; i < 3; i++) {
      const template = predictionTemplates[i];
      const coords = jitter(ward.center, 0.3);
      const ref = db.collection("predictions").doc();

      batch.set(ref, {
        id: ref.id,
        wardId: ward.wardId,
        ward: ward.ward,
        zone: `${ward.ward} — ${template.zone}`,
        category: template.category,
        probability: template.probability,
        confidenceLabel: template.confidenceLabel,
        reasoning: template.reasoning,
        basedOnIssueCount: randomInt(4, 9),
        timeWindowDays: template.timeWindowDays,
        location: new GeoPoint(coords.lat, coords.lng),
        generatedAt: daysAgo(randomInt(1, 3)),
        status: "active",
      });
    }
  }

  await batch.commit();
  console.log("✓ Seeded 15 prediction records");
}

// ─── Seed Citizen Accounts ────────────────────────────────────────────────────

async function seedCitizenAccounts() {
  console.log("Seeding 4 citizen accounts + 1 admin...");

  const citizens = [
    {
      uid: "citizen_raj",
      displayName: "Raj Kumar",
      photoURL: "https://api.dicebear.com/7.x/initials/svg?seed=RK",
      xpPoints: 450,
      reportCount: 12,
      verifyCount: 34,
      wardId: "ward_1",
      badges: ["first_report", "verifier_5", "ward_hero"],
    },
    {
      uid: "priya_s",
      displayName: "Priya Sharma",
      photoURL: "https://api.dicebear.com/7.x/initials/svg?seed=PS",
      xpPoints: 280,
      reportCount: 8,
      verifyCount: 20,
      wardId: "ward_2",
      badges: ["first_report", "verifier_5"],
    },
    {
      uid: "ward3_watch",
      displayName: "Ward 3 Watch",
      photoURL: "https://api.dicebear.com/7.x/initials/svg?seed=W3",
      xpPoints: 190,
      reportCount: 5,
      verifyCount: 18,
      wardId: "ward_3",
      badges: ["first_report"],
    },
    {
      uid: "new_reporter",
      displayName: "New Reporter",
      photoURL: "https://api.dicebear.com/7.x/initials/svg?seed=NR",
      xpPoints: 75,
      reportCount: 3,
      verifyCount: 4,
      wardId: "ward_4",
      badges: ["first_report"],
    },
  ];

  const batch = db.batch();

  for (const c of citizens) {
    // public_profiles/{uid} — globally readable, no PII
    batch.set(db.collection("public_profiles").doc(c.uid), {
      uid: c.uid,
      displayName: c.displayName,
      photoURL: c.photoURL,
      xpPoints: c.xpPoints,
      reportCount: c.reportCount,
      verifyCount: c.verifyCount,
      wardId: c.wardId,
      badges: c.badges,
    });

    // users/{uid} — private, auth-gated
    batch.set(db.collection("users").doc(c.uid), {
      uid: c.uid,
      isAdmin: false,
      wardId: c.wardId,
      badges: c.badges,
      createdAt: daysAgo(randomInt(30, 180)),
    });
  }

  // Admin account (users/ only — no public_profiles for admin)
  batch.set(db.collection("users").doc("admin_gullyfix"), {
    uid: "admin_gullyfix",
    isAdmin: true,
    wardId: "ward_1",
    badges: [],
    createdAt: daysAgo(200),
  });

  await batch.commit();
  console.log("✓ Seeded 4 citizen accounts + 1 admin");
}

// ─── Run ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🌱 GullyFix Seed Script Starting...\n");

  try {
    await seedIssues();
    await seedTownHallCluster();
    await seedPredictions();
    await seedCitizenAccounts();

    console.log("\n✅ All seed data written successfully.");
    console.log("   Run `firebase deploy --only firestore:rules,firestore:indexes` next.");
  } catch (err) {
    console.error("\n❌ Seed failed:", err);
    process.exit(1);
  }
}

main();
