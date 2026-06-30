import { NextResponse } from "next/server";
export const runtime = "edge";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { haversineMeters, latLngBoundingBox } from "@/lib/geo";
import { sanitizeText } from "@/lib/sanitize";
import { getEquityMultiplier } from '@/lib/ward-equity';
import { CorridorResult, CORRIDOR_TYPES, getCorridorLabel } from '@/lib/corridor';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const CLOUD_VISION_API_KEY = process.env.CLOUD_VISION_API_KEY || "";

const TRIAGE_FALLBACK = {
  decision: "new",
  mergeTargetId: null,
  category: "uncategorized",
  priorityScore: 50,
  department: "General Administration Dept.",
  aiReasoning: "Automatic triage unavailable — issue queued for manual review.",
  aiConfidence: 0,
  photoAltText: "Community issue reported by citizen.",
  resolutionSteps: ["Issue is under review by municipal staff."],
};

async function runCloudVision(photoURL: string): Promise<string[]> {
  if (!CLOUD_VISION_API_KEY) return [];
  try {
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${CLOUD_VISION_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { source: { imageUri: photoURL } },
            features: [
              { type: "LABEL_DETECTION", maxResults: 10 },
              { type: "OBJECT_LOCALIZATION", maxResults: 5 },
              { type: "SAFE_SEARCH_DETECTION" },
            ],
          }],
        }),
      }
    );
    const data = await res.json();
    const response = data.responses?.[0] || {};
    
    const safe = response.safeSearchAnnotation;
    if (safe && (safe.adult === "LIKELY" || safe.adult === "VERY_LIKELY" || safe.violence === "LIKELY" || safe.violence === "VERY_LIKELY")) {
      return ["SAFE_SEARCH_FLAGGED"];
    }

    return (response.labelAnnotations ?? [])
      .filter((a: any) => a.score > 0.6)
      .map((a: any) => a.description);
  } catch (err) {
    console.error("[Vision] Failed:", err);
    return [];
  }
}

async function getProximateIssues(lat: number, lng: number, excludeId: string) {
  const box = latLngBoundingBox(lat, lng, 1);

  const snap = await adminDb
    .collection("issues")
    .where("status", "in", ["open", "in_progress"])
    .where("location", ">=", new GeoPoint(box.minLat, box.minLng))
    .where("location", "<=", new GeoPoint(box.maxLat, box.maxLng))
    .orderBy("location")
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  const results = [];
  for (const doc of snap.docs) {
    if (doc.id === excludeId) continue;
    const d = doc.data();
    const dist = haversineMeters(lat, lng, d.location.latitude, d.location.longitude);
    if (dist > 1000) continue;
    results.push({
      id: doc.id,
      category: d.category,
      priorityScore: d.priorityScore ?? 50,
      distanceMeters: Math.round(dist),
      verifyCount: d.verifyCount ?? 0,
    });
  }

  return results.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 5);
}

async function runGeminiAgent(photoURL: string, userDescription: string, visionLabels: string[], nearbyIssues: any[], userReportedType: string | null) {
  if (!GEMINI_API_KEY) throw new Error("No Gemini API key");

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const nearbyCtx = nearbyIssues.length
    ? nearbyIssues.map(n => `- id:${n.id} | category:${n.category} | priority:${n.priorityScore} | distance:${n.distanceMeters}m | verifications:${n.verifyCount}`).join("\n")
    : "None";

  const prompt = `You are an AI agent for GullyFix, a civic infrastructure platform in India.
Analyze this issue report and make autonomous decisions.

VISION LABELS: ${visionLabels.join(", ") || "Not available"}
USER DESCRIPTION: ${userDescription || "Not provided"}

The citizen has self-reported this issue as: "${userReportedType || "unspecified"}".

Analyze the image independently. If your classification matches the citizen's 
report, state "Citizen classification confirmed." If it differs, state 
"Citizen reported ${userReportedType || "unspecified"} — AI detected [your category]. 
Proceeding with AI classification." Include this in your aiReasoning field.

NEARBY OPEN ISSUES (within 1km — strict metadata only):
${nearbyCtx}

Make these decisions:

1. DUPLICATE CHECK: "merge" into an existing nearby issue, or "new" unique issue?
   - If distance < 100m AND category matches → strongly consider merge.
   
2. CLASSIFICATION: road_damage | water_leakage | waste | streetlight | uncategorized
   - CRITICAL: If VISION LABELS contains "SAFE_SEARCH_FLAGGED", immediately classify as "uncategorized", set priority to 0, and state "Inappropriate content flagged by safe search" in aiReasoning.

3. PRIORITY SCORE: 0–100. Consider safety risk, verifications, severity in image.

4. DEPARTMENT: "Roads & Infrastructure Dept." | "Water Supply & Drainage Dept." | "Solid Waste Management Dept." | "Street Lighting Dept." | "General Administration Dept."

5. RESOLUTION STEPS: 2–3 concrete action steps the assigned department should take.
   Be specific (e.g., "Dispatch pothole repair crew within 48 hours", not "Fix the issue").

6. PHOTO ALT TEXT: concise accessibility description of the photo.

Return ONLY valid JSON. No markdown. No text outside the JSON object:
{
  "decision": "new" | "merge",
  "mergeTargetId": null | "issueId",
  "category": "road_damage" | "water_leakage" | "waste" | "streetlight" | "uncategorized",
  "priorityScore": 0-100,
  "department": "department string",
  "aiReasoning": "2-3 sentences of reasoning visible to citizens and admins",
  "aiConfidence": 0.0-1.0,
  "photoAltText": "concise alt text",
  "resolutionSteps": ["Step 1", "Step 2", "Step 3"]
}`;

  let imagePart = null;
  try {
    const imgRes = await fetch(photoURL);
    const buf = await imgRes.arrayBuffer();
    imagePart = {
      inlineData: {
        data: Buffer.from(buf).toString("base64"),
        mimeType: imgRes.headers.get("content-type") || "image/jpeg",
      },
    };
  } catch {
    console.warn("[Gemini] Could not fetch photo — text-only mode");
  }

  const parts = imagePart ? [{ text: prompt }, imagePart] : [{ text: prompt }];
  const result = await model.generateContent(parts);
  let text = result.response.text().trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) text = jsonMatch[0];

  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.resolutionSteps)) parsed.resolutionSteps = ["Awaiting department review."];
  return parsed;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { issueId, data } = body;

    if (!issueId || !data) {
      return NextResponse.json({ error: "Missing issueId or data" }, { status: 400 });
    }

    const lat = data.location?.latitude || data.location?.lat || 0;
    const lng = data.location?.longitude || data.location?.lng || 0;
    const photoURL = data.photoURL || "";
    const userDescription = sanitizeText(data.description || "", 500);
    const ward = data.ward || "";
    const city = data.city || "Mumbai";
    const userReportedType = data.userReportedType || null;

    const visionLabels = await runCloudVision(photoURL);
    
    // Skip nearby issues for now to avoid adminDb dependency
    let nearbyIssues: any[] = [];
    
    let agent;
    if (visionLabels.includes("SAFE_SEARCH_FLAGGED")) {
      agent = {
        decision: "new",
        mergeTargetId: null,
        category: "uncategorized",
        priorityScore: 0,
        department: "General Administration Dept.",
        aiReasoning: "Inappropriate content flagged by safe search. Issue hidden pending manual admin review.",
        aiConfidence: 1,
        photoAltText: "Content hidden.",
        resolutionSteps: ["Review flagged image for terms of service violation."],
      };
    } else {
      try {
        agent = await runGeminiAgent(photoURL, userDescription, visionLabels, nearbyIssues, userReportedType);
      } catch (err: any) {
        console.error("[TRIAGE_CRITICAL_FAIL]", err);
        agent = { ...TRIAGE_FALLBACK, aiReasoning: "Automatic triage temporarily unavailable due to network load. Issue queued for manual review." };
      }
    }

    // --- FEATURE 1: Democratic Equity Engine ---
    const equityData = getEquityMultiplier(city, ward);
    const basePriority = agent.priorityScore;
    const adjustedPriority = Math.min(99, Math.round(basePriority * equityData.multiplier));
    const equityApplied = equityData.multiplier !== 1.0;
    const equityDirection = equityData.multiplier > 1.0 ? "upgraded" : "downweighted";
    
    const equityTrace = equityApplied 
      ? `Ward equity index applied: ${ward} classified as "${equityData.label}" (tier ${equityData.tier}). Base priority ${basePriority} ${equityDirection} to ${adjustedPriority} (multiplier: ${equityData.multiplier}x).`
      : `Ward equity index: ${ward} is middle-income tier. No priority adjustment applied.`;

    // --- FEATURE 2: Vulnerable Corridor Multiplexer ---
    const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=150&type=hospital|school|transit_station|fire_station|police&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GEMINI_API_KEY}`;
    let corridorResult: CorridorResult = {
      detected: false,
      placeName: null,
      placeType: null,
      distanceMeters: null,
      slaMultiplier: 1.0,
      priorityBoost: 0,
      reason: null,
    };

    try {
      const placesRes = await fetch(placesUrl);
      const placesData = await placesRes.json();
      
      if (placesData.results?.length > 0) {
        const nearest = placesData.results[0];
        const placeType = CORRIDOR_TYPES.find(t => nearest.types.includes(t)) || 'hospital';
        
        corridorResult = {
          detected: true,
          placeName: nearest.name,
          placeType,
          distanceMeters: Math.round(nearest.geometry?.location 
            ? getDistanceMeters(lat, lng, nearest.geometry.location.lat, nearest.geometry.location.lng)
            : 100),
          slaMultiplier: 0.5,
          priorityBoost: 12,
          reason: `${getCorridorLabel(placeType)} "${nearest.name}" within 150m`,
        };
      }
    } catch (err) {
      console.error("[triage] Places API failed:", err);
    }

    const finalPriority = Math.min(99, adjustedPriority + corridorResult.priorityBoost);

    // Return the payload back to the client to do the update
    let updatePayload: any = {};
    if (agent.decision === "merge" && agent.mergeTargetId) {
      updatePayload = {
        isMerge: true,
        mergeTargetId: agent.mergeTargetId,
        status: "merged",
        category: agent.category || "uncategorized",
        aiConfidence: agent.aiConfidence || 0,
        priorityScore: agent.priorityScore || 0,
        aiReasoning: agent.aiReasoning,
        visionLabels,
        photoAltText: agent.photoAltText,
      };
    } else {
      let slaDays = 7;
      if (agent.category === "road_damage") slaDays = 7;
      if (agent.category === "water_leakage") slaDays = 2;
      if (agent.category === "waste") slaDays = 2;
      if (agent.category === "streetlight") slaDays = 3;
      
      slaDays = slaDays * corridorResult.slaMultiplier;
      
      updatePayload = {
        isMerge: false,
        status: "open",
        category: agent.category,
        priorityScore: finalPriority,
        department: agent.department,
        aiReasoning: agent.aiReasoning,
        aiConfidence: agent.aiConfidence,
        resolutionSteps: agent.resolutionSteps,
        visionLabels,
        photoAltText: agent.photoAltText,
        mergedIntoId: null,
        slaDays: slaDays, // Client will compute Timestamp
        slaBreached: false,
        escalationLevel: 0,
        jurisdictionDisputed: false,
        
        equityMultiplier: equityData.multiplier,
        equityTier: equityData.tier,
        equityLabel: equityData.label,
        basePriority: basePriority,
        equityTrace: equityTrace,

        corridorDetected: corridorResult.detected,
        corridorPlaceName: corridorResult.placeName,
        corridorPlaceType: corridorResult.placeType,
        corridorDistanceMeters: corridorResult.distanceMeters,
        slaMultiplier: corridorResult.slaMultiplier,
      };
    }

    return NextResponse.json({ success: true, triageResult: updatePayload });
  } catch (err: any) {
    console.error("[triage API] Error:", err);
    return NextResponse.json({ error: "Triage pipeline encountered an error." }, { status: 500 });
  }
}

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
