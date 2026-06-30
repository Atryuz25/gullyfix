import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { issueId, after } = body;

    if (!issueId || !after) {
      return NextResponse.json({ error: "Missing issueId or data" }, { status: 400 });
    }
    
    const photoURL = after.photoURL;
    const resolutionPhotoUrl = after.resolutionPhotoUrl || after.resolutionPhotoURL;
    const disputePhotoUrl = after.disputePhotoUrl || after.disputePhotoURL;

    if (!photoURL || !resolutionPhotoUrl || !disputePhotoUrl) {
      return NextResponse.json({ error: "Missing required photos for 3-way audit" }, { status: 400 });
    }

    if (!GEMINI_API_KEY) throw new Error("No Gemini API key");

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const fetchImage = async (url: string) => {
      try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        return {
          inlineData: {
            data: Buffer.from(buf).toString("base64"),
            mimeType: res.headers.get("content-type") || "image/jpeg",
          }
        };
      } catch (err) {
        console.error("Failed to fetch image", url);
        return null;
      }
    };

    const [img1, img2, img3] = await Promise.all([
      fetchImage(photoURL),
      fetchImage(resolutionPhotoUrl),
      fetchImage(disputePhotoUrl)
    ]);

    if (!img1 || !img2 || !img3) {
       return NextResponse.json({ error: "Failed to load images" }, { status: 500 });
    }

    const prompt = `You are an autonomous civic infrastructure auditor.
You have been provided three images:
1. ORIGINAL: The hazard as reported by a citizen.
2. RESOLUTION: Photo uploaded by the municipal officer claiming repair.
3. DISPUTE: Photo uploaded by the citizen claiming the issue persists.

Analyze all three images and return ONLY valid JSON:
{
  "persistenceConfirmed": boolean,
  "trustScore": number,
  "reasoning": "string",
  "recommendation": "escalate" | "close" | "reinspect"
}

If trustScore < 0.65, the resolution is rejected.
Do not return anything outside the JSON object.`;

    const result = await model.generateContent([
      { text: prompt },
      { text: "Image 1 (ORIGINAL):" }, img1,
      { text: "Image 2 (RESOLUTION):" }, img2,
      { text: "Image 3 (DISPUTE):" }, img3
    ]);

    const text = result.response.text().trim()
      .replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    
    let audit;
    try {
      audit = JSON.parse(text);
    } catch (e) {
      console.warn("[verify API] Gemini output was not valid JSON, using fallback", text);
      audit = {
        persistenceConfirmed: true,
        trustScore: 0,
        reasoning: "AI verification failed to process image safely. Queued for manual admin reinspection.",
        recommendation: "reinspect"
      };
    }

    const updateData: any = {
      disputeReasoning: `[DISPUTE VERIFICATION] ${audit.reasoning}`,
      disputeTrustScore: audit.trustScore,
      disputeRecommendation: audit.recommendation,
    };

    if (audit.persistenceConfirmed) {
      updateData.status = "open";
      updateData.escalationLevel = FieldValue.increment(1);

      // --- FEATURE 3: Department Blacklist & Reputation System ---
      try {
        const issueDoc = await adminDb.collection("issues").doc(issueId).get();
        const issueData = issueDoc.data();
        if (issueData?.department) {
          const deptKey = issueData.department.toLowerCase().replace(/\s+/g, '_');
          const deptRef = adminDb.collection('departments').doc(deptKey);
          const deptDoc = await deptRef.get();

          if (deptDoc.exists) {
            const dept = deptDoc.data()!;
            const newScore = Math.max(0, dept.reputationScore - 12);
            const blacklisted = newScore < 40;
            
            await deptRef.update({
              reputationScore: newScore,
              ghostResolutionCount: (dept.ghostResolutionCount || 0) + 1,
              blacklisted,
              blacklistedUntil: blacklisted 
                ? Timestamp.fromDate(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000))
                : null,
              lastUpdated: Timestamp.now(),
            });

            updateData.departmentReputationImpact = -12;
            updateData.departmentNewScore = newScore;
            updateData.departmentBlacklisted = blacklisted;
          }
        }
      } catch (err) {
        console.error("[verify API] Failed to update department reputation:", err);
      }
    }

    await adminDb.collection("issues").doc(issueId).update(updateData);

    return NextResponse.json({ success: true, audit });
  } catch (err: any) {
    console.error("[verify API] Error:", err);
    try {
      const body = await req.clone().json();
      if (body?.issueId) {
        await adminDb.collection("issues").doc(body.issueId).update({
          disputeReasoning: "Automatic 3-way verification temporarily unavailable. Queued for manual review.",
          disputeRecommendation: "reinspect",
          status: "disputed"
        });
      }
    } catch (e) {
      console.error("[verify API] Fallback update failed", e);
    }
    return NextResponse.json({ error: "Verification pipeline encountered an error but issue was flagged for review." }, { status: 500 });
  }
}
