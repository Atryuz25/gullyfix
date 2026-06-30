const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore, GeoPoint, Timestamp } = require("firebase-admin/firestore");
const path = require("path");

// Init Firebase
const serviceAccountPath = path.resolve(__dirname, "../service-account.json");
const serviceAccount = require(serviceAccountPath);

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

// ─── Data Maps ───────────────────────────────────────────────────────────────

const LOCATIONS = {
  "Hyderabad": { state: "Telangana", deptSuffix: "GHMC", wards: {
    "Jubilee Hills": { lat: 17.4326, lng: 78.4071 },
    "Banjara Hills": { lat: 17.4156, lng: 78.4347 },
    "HITEC City": { lat: 17.4435, lng: 78.3772 },
    "Gachibowli": { lat: 17.4401, lng: 78.3489 },
    "Madhapur": { lat: 17.4483, lng: 78.3915 },
    "Kukatpally": { lat: 17.4849, lng: 78.3890 },
    "Secunderabad": { lat: 17.4399, lng: 78.4983 },
    "L.B. Nagar": { lat: 17.3457, lng: 78.5522 },
    "Uppal": { lat: 17.4018, lng: 78.5602 },
    "Mehdipatnam": { lat: 17.3916, lng: 78.4398 },
    "Charminar": { lat: 17.3616, lng: 78.4747 },
    "Tarnaka": { lat: 17.4298, lng: 78.5375 },
    "BHEL": { lat: 17.5110, lng: 78.3182 },
    "ECIL": { lat: 17.4746, lng: 78.5702 },
    "Bowenpally": { lat: 17.4682, lng: 78.4716 },
    "Miyapur": { lat: 17.4968, lng: 78.3614 },
    "Kondapur": { lat: 17.4622, lng: 78.3568 },
    "Dilsukhnagar": { lat: 17.3688, lng: 78.5247 },
    "Attapur": { lat: 17.3653, lng: 78.4312 },
    "Shamshabad": { lat: 17.2628, lng: 78.3969 }
  }},
  "Bengaluru": { state: "Karnataka", deptSuffix: "BBMP", wards: {
    "Koramangala": { lat: 12.9279, lng: 77.6271 },
    "Indiranagar": { lat: 12.9784, lng: 77.6408 },
    "Whitefield": { lat: 12.9698, lng: 77.7499 },
    "Jayanagar": { lat: 12.9299, lng: 77.5826 },
    "Hebbal": { lat: 13.0354, lng: 77.5988 },
    "Yelahanka": { lat: 13.1007, lng: 77.5963 },
    "Electronic City": { lat: 12.8399, lng: 77.6770 },
    "Marathahalli": { lat: 12.9569, lng: 77.7011 },
    "Malleshwaram": { lat: 13.0068, lng: 77.5816 },
    "Basavanagudi": { lat: 12.9406, lng: 77.5738 },
    "Rajajinagar": { lat: 12.9982, lng: 77.5530 },
    "BTM Layout": { lat: 12.9166, lng: 77.6101 },
    "HSR Layout": { lat: 12.9121, lng: 77.6446 },
    "Banashankari": { lat: 12.9255, lng: 77.5468 },
    "Peenya": { lat: 13.0285, lng: 77.5197 },
    "R.T. Nagar": { lat: 13.0247, lng: 77.5948 },
    "Bellandur": { lat: 12.9304, lng: 77.6784 },
    "K.R. Puram": { lat: 13.0076, lng: 77.6953 },
    "Vidyaranyapura": { lat: 13.0784, lng: 77.5588 },
    "Vijay Nagar": { lat: 12.9756, lng: 77.5354 }
  }},
  "Chennai": { state: "Tamil Nadu", deptSuffix: "GCC", wards: {
    "T Nagar": { lat: 13.0418, lng: 80.2341 },
    "Anna Nagar": { lat: 13.0850, lng: 80.2101 },
    "Adyar": { lat: 13.0012, lng: 80.2565 },
    "Velachery": { lat: 12.9754, lng: 80.2206 },
    "Mylapore": { lat: 13.0368, lng: 80.2676 },
    "Perambur": { lat: 13.1118, lng: 80.2443 },
    "Tambaram": { lat: 12.9249, lng: 80.1000 },
    "Porur": { lat: 13.0382, lng: 80.1601 },
    "Thiruvanmiyur": { lat: 12.9860, lng: 80.2606 },
    "Guindy": { lat: 13.0067, lng: 80.2206 },
    "Chromepet": { lat: 12.9516, lng: 80.1408 },
    "Vadapalani": { lat: 13.0500, lng: 80.2121 },
    "Royapuram": { lat: 13.1122, lng: 80.2954 },
    "Pallavaram": { lat: 12.9692, lng: 80.1433 },
    "OMR": { lat: 12.8797, lng: 80.2267 },
    "Nungambakkam": { lat: 13.0604, lng: 80.2415 },
    "Avadi": { lat: 13.1165, lng: 80.1026 },
    "Ambattur": { lat: 13.1143, lng: 80.1548 },
    "Saidapet": { lat: 13.0213, lng: 80.2231 }
  }},
  "Mumbai": { state: "Maharashtra", deptSuffix: "BMC", wards: {
    "Andheri": { lat: 19.1136, lng: 72.8697 },
    "Bandra": { lat: 19.0596, lng: 72.8295 },
    "Dadar": { lat: 19.0178, lng: 72.8478 },
    "Kurla": { lat: 19.0728, lng: 72.8797 },
    "Borivali": { lat: 19.2307, lng: 72.8567 },
    "Colaba": { lat: 18.9067, lng: 72.8147 },
    "Malad": { lat: 19.1860, lng: 72.8485 },
    "Ghatkopar": { lat: 19.0856, lng: 72.9081 },
    "Powai": { lat: 19.1197, lng: 72.9051 },
    "Chembur": { lat: 19.0522, lng: 72.8996 },
    "Vashi": { lat: 19.0771, lng: 72.9986 },
    "Thane": { lat: 19.2183, lng: 72.9781 },
    "Goregaon": { lat: 19.1648, lng: 72.8500 },
    "Lower Parel": { lat: 18.9953, lng: 72.8300 },
    "Navi Mumbai": { lat: 19.0330, lng: 73.0297 },
    "Dahisar": { lat: 19.2501, lng: 72.8593 },
    "Mulund": { lat: 19.1718, lng: 72.9556 },
    "Santacruz": { lat: 19.0838, lng: 72.8383 },
    "Vile Parle": { lat: 19.1000, lng: 72.8427 },
    "Churchgate": { lat: 18.9322, lng: 72.8264 }
  }},
  "Delhi": { state: "Delhi", deptSuffix: "MCD", wards: {
    "Connaught Place": { lat: 28.6304, lng: 77.2177 },
    "Dwarka": { lat: 28.5823, lng: 77.0500 },
    "Rohini": { lat: 28.7366, lng: 77.1130 },
    "Saket": { lat: 28.5246, lng: 77.2066 },
    "Mayur Vihar": { lat: 28.6083, lng: 77.2974 },
    "Vasant Kunj": { lat: 28.5298, lng: 77.1558 },
    "Karol Bagh": { lat: 28.6515, lng: 77.1906 },
    "Janakpuri": { lat: 28.6219, lng: 77.0878 },
    "Pitampura": { lat: 28.6989, lng: 77.1384 },
    "Hauz Khas": { lat: 28.5494, lng: 77.2001 },
    "Laxmi Nagar": { lat: 28.6304, lng: 77.2773 },
    "Okhla": { lat: 28.5355, lng: 77.2831 },
    "Chandni Chowk": { lat: 28.6505, lng: 77.2303 },
    "Green Park": { lat: 28.5587, lng: 77.2040 },
    "Lajpat Nagar": { lat: 28.5677, lng: 77.2433 },
    "R.K. Puram": { lat: 28.5670, lng: 77.1772 }
  }},
  "Coimbatore": { state: "Tamil Nadu", deptSuffix: "CCMC", wards: {
    "RS Puram": { lat: 11.0076, lng: 76.9497 },
    "Gandhipuram": { lat: 11.0181, lng: 76.9657 },
    "Peelamedu": { lat: 11.0250, lng: 77.0000 },
    "Saibaba Colony": { lat: 11.0251, lng: 76.9407 }
  }},
  "Pune": { state: "Maharashtra", deptSuffix: "PMC", wards: {
    "Koregaon Park": { lat: 18.5362, lng: 73.8939 },
    "Kothrud": { lat: 18.5074, lng: 73.8077 },
    "Hadapsar": { lat: 18.5089, lng: 73.9259 },
    "Shivajinagar": { lat: 18.5314, lng: 73.8446 }
  }},
  "Ahmedabad": { state: "Gujarat", deptSuffix: "AMC", wards: {
    "Navrangpura": { lat: 23.0360, lng: 72.5463 },
    "Satellite": { lat: 23.0294, lng: 72.5117 },
    "Maninagar": { lat: 22.9996, lng: 72.6025 },
    "Bopal": { lat: 23.0321, lng: 72.4646 }
  }},
  "Jaipur": { state: "Rajasthan", deptSuffix: "JMC", wards: {
    "Malviya Nagar": { lat: 26.8524, lng: 75.8159 },
    "Vaishali Nagar": { lat: 26.9075, lng: 75.7397 },
    "Mansarovar": { lat: 26.8624, lng: 75.7621 },
    "C Scheme": { lat: 26.9100, lng: 75.8016 }
  }},
  "Kolkata": { state: "West Bengal", deptSuffix: "KMC", wards: {
    "Salt Lake": { lat: 22.5855, lng: 88.4143 },
    "Park Street": { lat: 22.5513, lng: 88.3533 },
    "Ballygunge": { lat: 22.5281, lng: 88.3653 },
    "Howrah": { lat: 22.5958, lng: 88.2636 }
  }},
  "Lucknow": { state: "Uttar Pradesh", deptSuffix: "LMC", wards: {
    "Hazratganj": { lat: 26.8504, lng: 80.9388 },
    "Gomti Nagar": { lat: 26.8530, lng: 81.0101 },
    "Aliganj": { lat: 26.8833, lng: 80.9429 },
    "Indira Nagar": { lat: 26.8856, lng: 80.9995 }
  }},
  "Kochi": { state: "Kerala", deptSuffix: "KMC", wards: {
    "Ernakulam": { lat: 9.9816, lng: 76.2999 },
    "Fort Kochi": { lat: 9.9634, lng: 76.2384 },
    "Kakkanad": { lat: 10.0270, lng: 76.3312 },
    "Edapally": { lat: 10.0249, lng: 76.3113 }
  }},
  "Madurai": { state: "Tamil Nadu", deptSuffix: "MMC", wards: {
    "Anna Nagar": { lat: 9.9272, lng: 78.1471 },
    "KK Nagar": { lat: 9.9328, lng: 78.1517 },
    "Tallakulam": { lat: 9.9372, lng: 78.1368 },
    "Iyer Bungalow": { lat: 9.9676, lng: 78.1340 }
  }},
  "Nagpur": { state: "Maharashtra", deptSuffix: "NMC", wards: {
    "Dharampeth": { lat: 21.1444, lng: 79.0631 },
    "Sitabuldi": { lat: 21.1422, lng: 79.0837 },
    "Sadar": { lat: 21.1610, lng: 79.0818 },
    "Manish Nagar": { lat: 21.0984, lng: 79.0664 }
  }},
  "Visakhapatnam": { state: "Andhra Pradesh", deptSuffix: "GVMC", wards: {
    "MVP Colony": { lat: 17.7408, lng: 83.3364 },
    "Rushikonda": { lat: 17.7828, lng: 83.3855 },
    "Gajuwaka": { lat: 17.6908, lng: 83.2084 },
    "Seethammadhara": { lat: 17.7431, lng: 83.3106 }
  }},
  "Bhopal": { state: "Madhya Pradesh", deptSuffix: "BMC", wards: {
    "MP Nagar": { lat: 23.2332, lng: 77.4343 },
    "Arera Colony": { lat: 23.2078, lng: 77.4339 },
    "Habibganj": { lat: 23.2195, lng: 77.4342 },
    "Kolar Road": { lat: 23.1678, lng: 77.4243 }
  }},
  "Surat": { state: "Gujarat", deptSuffix: "SMC", wards: {
    "Adajan": { lat: 21.1959, lng: 72.7933 },
    "Vesu": { lat: 21.1418, lng: 72.7709 },
    "Athwalines": { lat: 21.1787, lng: 72.7997 },
    "Katargam": { lat: 21.2291, lng: 72.8258 }
  }},
  "Indore": { state: "Madhya Pradesh", deptSuffix: "IMC", wards: {
    "Vijay Nagar": { lat: 22.7533, lng: 75.8937 },
    "Palasia": { lat: 22.7237, lng: 75.8916 },
    "Scheme 54": { lat: 22.7566, lng: 75.8953 },
    "Rajwada": { lat: 22.7183, lng: 75.8569 }
  }}
};

const CATEGORIES = [
  { id: "road_damage", name: "Roads", slaDays: 7, photos: ["https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800"] },
  { id: "water_leakage", name: "Water", slaDays: 2, photos: ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800"] },
  { id: "streetlight", name: "Electrical", slaDays: 3, photos: ["https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800"] },
  { id: "waste", name: "Sanitation", slaDays: 4, photos: ["https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=800"] }
];

const RESOLUTION_PHOTOS = [
  "https://images.unsplash.com/photo-1581092334245-d411132646d6?w=800",
  "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=800",
  "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800"
];

const REASONINGS = [
  "High priority due to immediate safety hazard and multiple citizen reports in the vicinity.",
  "Requires urgent department dispatch to prevent further infrastructure deterioration.",
  "Moderate severity issue affecting local traffic flow; scheduled for standard SLA resolution.",
  "Significant localized impact. Department crew needed for full structural assessment.",
  "Routine civic maintenance required. Logged and assigned to next available patrol."
];

// Distribution: 1610 total
const STATUS_DIST = [
  ...Array(600).fill("open"),
  ...Array(250).fill("in_progress"),
  ...Array(300).fill("resolved"),
  ...Array(200).fill("pending_verification"),
  ...Array(100).fill("disputed"),
  ...Array(50).fill("merged")
];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function jitterCoordinate(coord, offset = 0.005) {
  return coord + (Math.random() - 0.5) * offset;
}

// ─── Seeding Logic ────────────────────────────────────────────────────────────

async function seed() {
  console.log("Wiping existing issues to prevent overlap...");
  const oldSnap = await db.collection("issues").get();
  let delBatch = db.batch();
  let delCount = 0;
  for (const doc of oldSnap.docs) {
    delBatch.delete(doc.ref);
    delCount++;
    if (delCount % 500 === 0) {
      await delBatch.commit();
      delBatch = db.batch();
    }
  }
  if (delCount % 500 !== 0) await delBatch.commit();
  console.log(`✅ Wiped ${delCount} old issues.`);

  console.log("Starting GullyFix Pan-India Seeding (1610 Issues)...");

  // Shuffle statuses
  for (let i = STATUS_DIST.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [STATUS_DIST[i], STATUS_DIST[j]] = [STATUS_DIST[j], STATUS_DIST[i]];
  }

  let batch = db.batch();
  let issueCount = 0;

  const cityQuotas = {
    "Hyderabad": 120, "Bengaluru": 120, "Chennai": 120, "Mumbai": 120, "Delhi": 120,
    "Coimbatore": 60, "Pune": 60, "Ahmedabad": 60, "Jaipur": 60, "Kolkata": 60, "Lucknow": 60, "Kochi": 60,
    "Madurai": 30, "Nagpur": 30, "Visakhapatnam": 30, "Bhopal": 30, "Surat": 30, "Indore": 30
  };

  for (const [city, data] of Object.entries(LOCATIONS)) {
    const quota = cityQuotas[city];
    const wardKeys = Object.keys(data.wards);
    let cityCount = 0;

    for (let i = 0; i < quota; i++) {
      const wardName = wardKeys[i % wardKeys.length];
      const wardBase = data.wards[wardName];
      
      const cat = randomChoice(CATEGORIES);
      const status = STATUS_DIST[issueCount % STATUS_DIST.length];
      
      // Massive jitter for full city spread (~15-20km radius)
      const lat = jitterCoordinate(wardBase.lat, 0.15);
      const lng = jitterCoordinate(wardBase.lng, 0.15);

      // Times
      const daysAgo = randomInt(1, 30);
      const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const slaDeadline = new Date(createdAt.getTime() + cat.slaDays * 24 * 60 * 60 * 1000);
      const slaBreached = (status === "open" || status === "in_progress") && slaDeadline < new Date();

      const docRef = db.collection("issues").doc();
      const issueData = {
        category: cat.id,
        userReportedType: cat.id,
        department: `${data.deptSuffix} ${cat.name}`,
        description: `Severe ${cat.name.toLowerCase()} issue reported in ${wardName}, ${city}. Needs immediate attention from municipal staff.`,
        priorityScore: randomInt(30, 95),
        status: status,
        location: new GeoPoint(lat, lng),
        address: `Near Main Road, ${wardName}, ${city}`,
        ward: wardName,
        wardId: wardName.toLowerCase().replace(/\s+/g, '_'),
        city: city,
        state: data.state,
        reportedBy: `seed_user_0${randomInt(1, 8)}`,
        reporterName: "Citizen Reporter",
        verifyCount: randomInt(0, 15),
        slaBreached: slaBreached,
        slaDeadline: Timestamp.fromDate(slaDeadline),
        createdAt: Timestamp.fromDate(createdAt),
        photoURL: cat.photos[0],
        aiReasoning: randomChoice(REASONINGS),
        escalationLevel: status === "disputed" ? 1 : (slaBreached ? 2 : 0),
        disputePhotoURL: status === "disputed" ? "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800" : null,
        resolutionPhotoURL: (status === "resolved" || status === "pending_verification") ? randomChoice(RESOLUTION_PHOTOS) : null,
      };

      batch.set(docRef, issueData);
      issueCount++;
      cityCount++;

      if (issueCount % 500 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    console.log(`Seeding ${city}... done (${cityCount} issues)`);
  }

  if (issueCount % 500 !== 0) {
    await batch.commit();
  }
  
  console.log(`✅ ${issueCount} issues seeded across 18 cities`);
  process.exit(0);
}

seed().catch(console.error);
