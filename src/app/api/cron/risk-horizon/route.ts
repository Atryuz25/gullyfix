import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Timestamp, GeoPoint, FieldValue } from "firebase-admin/firestore";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export async function GET() {
  console.log("[generatePredictions] Starting nightly prediction run...");

  try {
    const wardsSnap = await adminDb.collection("wards").get();
    if (wardsSnap.empty) {
      return NextResponse.json({ message: "No wards found" });
    }

    if (!GEMINI_API_KEY) throw new Error("No Gemini API key");
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const thirtyDaysAgo = Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    for (const wardDoc of wardsSnap.docs) {
      const ward = wardDoc.data();
      const wardId = ward.wardId;

      try {
        const issuesSnap = await adminDb
          .collection("issues")
          .where("wardId", "==", wardId)
          .where("status", "!=", "merged")
          .where("createdAt", ">=", thirtyDaysAgo)
          .get();

        if (issuesSnap.size < 3) continue;

        const issues = issuesSnap.docs.map(d => d.data());
        const openIssues = issues.filter(i => i.status === "open" || i.status === "in_progress");
        const recentResolved = issues.filter(i => i.status === "resolved");

        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recentNew = issues.filter(i => i.createdAt?.toMillis() > weekAgo).length;

        const categoryBreakdown = issues.reduce((acc: Record<string, number>, i) => {
          acc[i.category] = (acc[i.category] || 0) + 1;
          return acc;
        }, {});

        const avgPriority = issues.reduce((s, i) => s + (i.priorityScore || 50), 0) / issues.length;

        const prompt = `You are an infrastructure failure prediction AI for GullyFix, a civic platform in India.
Analyze this ward's recent data and predict the SINGLE most likely infrastructure failure in the next 30 days.

WARD: ${ward.ward} (${wardId})
HEALTH SCORE: ${ward.healthScore}/100 (${ward.urgencyLevel} urgency)
AVG RESOLUTION TIME: ${ward.avgResolutionDays} days
TOTAL ISSUES (last 30 days): ${issues.length}
OPEN ISSUES: ${openIssues.length}
RECENTLY RESOLVED: ${recentResolved.length}
NEW THIS WEEK: ${recentNew} (trend indicator)
AVG PRIORITY SCORE: ${avgPriority.toFixed(0)}/100
CATEGORY BREAKDOWN: ${JSON.stringify(categoryBreakdown)}
TOP ISSUE CATEGORY: ${ward.topIssueCategory}
GEMINI ADVISORY: ${ward.healthReasoning}

Based on this data, predict the most likely infrastructure failure:
- High volume of one category suggests systemic failure
- Long avg resolution + high open count = backlog risk
- Consider monsoon patterns for road/drainage issues

Return ONLY valid JSON, no markdown:
{
  "category": "road_damage" | "water_leakage" | "waste" | "streetlight",
  "probability": 0.0-1.0,
  "confidenceLabel": "e.g. 78% probability",
  "reasoning": "2-3 sentences citing the specific data evidence above. Be concrete.",
  "timeWindowDays": 7-30,
  "severity": "low" | "medium" | "high" | "critical"
}`;

        const result = await model.generateContent(prompt);
        const raw = result.response.text().trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
        const prediction = JSON.parse(raw);

        const locationIssues = openIssues.filter(i => i.location);
        let lat = ward.location?.latitude || 17.4239;
        let lng = ward.location?.longitude || 78.4062;

        if (locationIssues.length > 0) {
          lat = locationIssues.reduce((s, i: any) => s + i.location.latitude, 0) / locationIssues.length;
          lng = locationIssues.reduce((s, i: any) => s + i.location.longitude, 0) / locationIssues.length;
        }

        const predictionId = `${wardId}_${prediction.category}`;
        await adminDb.collection("predictions").doc(predictionId).set({
          id: predictionId,
          wardId,
          ward: ward.ward,
          zone: "Central",
          category: prediction.category,
          probability: Math.min(1, Math.max(0, prediction.probability)),
          confidenceLabel: prediction.confidenceLabel,
          reasoning: prediction.reasoning,
          severity: prediction.severity || "medium",
          timeWindowDays: prediction.timeWindowDays,
          basedOnIssueCount: issues.length,
          location: new GeoPoint(lat, lng),
          generatedAt: FieldValue.serverTimestamp(),
          status: "active",
        }, { merge: true });

      } catch (err) {
        console.error(`[generatePredictions] Failed for ${wardId}:`, err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[generatePredictions] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
